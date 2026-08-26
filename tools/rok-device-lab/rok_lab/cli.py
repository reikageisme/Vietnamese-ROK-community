from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path

from .adb import AdbClient, AdbError, load_aliases, resolve_device
from .agent import DeviceAgent
from .collector import upload_scan
from .control_client import ControlClient, load_agent_config
from .fleet_ranking_scanner import run_fleet_ranking_job
from .fleet_scanner import load_fleet_job, run_fleet_job
from .kingdom_scanner import KingdomScanner, ScanOptions
from .profiles import load_profile
from .ranking_reader import read_visible_power_ranking
from .ranking_scanner import RankingScanner, RankingScanOptions
from .rankings import open_ranking, probe_rankings_menu
from .scrcpy import find_scrcpy, launch_scrcpy

LAB_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = LAB_ROOT / "config" / "devices.local.json"
DEFAULT_ARTIFACTS = LAB_ROOT / "artifacts"
DEFAULT_PROFILE = LAB_ROOT / "profiles" / "rok-a51-1920x1080.json"


def _configure_console() -> None:
    # Python launched from some Windows hosts still inherits a legacy cp1252
    # stream even when the terminal itself supports UTF-8.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8", errors="replace")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rok-device",
        description="ROK FAQ Device Lab — điều khiển nhiều Android an toàn theo serial.",
    )
    parser.add_argument("--adb", help="Đường dẫn adb; mặc định tự phát hiện.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    subcommands = parser.add_subparsers(dest="command", required=True)

    subcommands.add_parser("doctor", help="Kiểm tra ADB, scrcpy và thiết bị.")
    subcommands.add_parser("devices", help="Liệt kê thiết bị ADB.")
    snapshot = subcommands.add_parser(
        "snapshot", help="Đọc trạng thái mọi thiết bị song song và lưu JSON."
    )
    snapshot.add_argument("--output", type=Path)
    fleet_probe = subcommands.add_parser(
        "fleet-probe",
        help="Chụp và kiểm tra màn Rankings của mọi thiết bị, không chạm game.",
    )
    fleet_probe.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    fleet_probe.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    upload = subcommands.add_parser(
        "upload-scan", help="Gửi scan JSON đã chuẩn hóa lên ROK FAQ."
    )
    upload.add_argument("file", type=Path)
    upload.add_argument("--url", help="Base URL; mặc định ROK_COLLECTOR_URL.")

    for name, help_text in (
        ("inspect", "Đọc thông tin phần cứng, Android, pin và Wi-Fi."),
        ("screenshot", "Chụp màn hình PNG."),
        ("wifi-open", "Mở trang Wi-Fi trên đúng thiết bị."),
        ("wifi-status", "Đọc trạng thái Wi-Fi."),
        ("ui-dump", "Xuất cây UI để xây adapter cho ROM."),
        ("wake", "Bật màn hình bằng KEYCODE_WAKEUP."),
        ("home", "Về màn hình chính."),
        ("live", "Mở cửa sổ scrcpy nhẹ."),
    ):
        command = subcommands.add_parser(name, help=help_text)
        command.add_argument("device", help="Alias (phone01) hoặc ADB serial.")
        if name == "screenshot":
            command.add_argument("--output", type=Path)
        if name == "live":
            command.add_argument("--scrcpy", help="Đường dẫn scrcpy.")
            command.add_argument("--max-size", type=int, default=720)
            command.add_argument("--max-fps", type=int, default=15)

    tap = subcommands.add_parser("tap", help="Chạm tọa độ để kiểm thử có kiểm soát.")
    tap.add_argument("device", help="Alias hoặc ADB serial.")
    tap.add_argument("x", type=int)
    tap.add_argument("y", type=int)

    rankings_probe = subcommands.add_parser(
        "rankings-probe",
        help="Xác minh một máy đang mở đúng menu Rankings, không chạm game.",
    )
    rankings_probe.add_argument("device", help="Alias hoặc ADB serial.")
    rankings_probe.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    rankings_probe.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)

    rankings_open = subcommands.add_parser(
        "rankings-open",
        help="Mở một bảng xếp hạng sau khi guard xác minh đúng màn hình.",
    )
    rankings_open.add_argument("device", help="Alias hoặc ADB serial.")
    rankings_open.add_argument(
        "ranking",
        choices=("individual-power", "individual-kills", "resource-gathering"),
    )
    rankings_open.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    rankings_open.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    rankings_open.add_argument(
        "--confirm",
        action="store_true",
        help="Xác nhận cho phép gửi đúng một thao tác chạm vào thiết bị.",
    )

    rankings_read = subcommands.add_parser(
        "rankings-read",
        help="OCR 6 thống đốc đang hiển thị trong bảng Individual Power.",
    )
    rankings_read.add_argument("device", help="Alias hoặc ADB serial.")
    rankings_read.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    rankings_read.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    rankings_read.add_argument("--tesseract", help="Đường dẫn tesseract.exe.")
    rankings_read.add_argument("--tessdata", help="Thư mục chứa *.traineddata.")

    kingdom_scan = subcommands.add_parser(
        "kingdom-scan",
        help="Quét nhiều governor, tự cuộn, resume và xuất XLSX/CSV/JSONL.",
    )
    kingdom_scan.add_argument("device", help="Alias hoặc ADB serial.")
    kingdom_scan.add_argument("--kingdom", type=int, required=True)
    kingdom_scan.add_argument("--amount", type=int, default=300)
    kingdom_scan.add_argument("--name", default="kingdom")
    kingdom_scan.add_argument("--formats", default="xlsx,csv,jsonl")
    kingdom_scan.add_argument(
        "--evidence", choices=("all", "review", "none"), default="review"
    )
    kingdom_scan.add_argument("--resume", type=Path)
    kingdom_scan.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    kingdom_scan.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    kingdom_scan.add_argument("--tesseract", help="Đường dẫn tesseract.exe.")
    kingdom_scan.add_argument("--tessdata", help="Thư mục chứa *.traineddata.")
    kingdom_scan.add_argument(
        "--scroll-duration-ms",
        type=int,
        default=1500,
        help="Thoi gian vuot. Cang ngan cang de bi fling va nhay mat dong.",
    )
    kingdom_scan.add_argument(
        "--scroll-fraction",
        type=float,
        default=0.35,
        help="Phan quang duong vuot so voi profile. Nho hon = chong lan nhieu hon.",
    )
    kingdom_scan.add_argument(
        "--rows-per-page",
        type=int,
        default=5,
        help="So hang doc moi trang. Hang thu 6 hay bam truot nen mac dinh bo.",
    )
    kingdom_scan.add_argument("--confirm", action="store_true")

    fleet_scan = subcommands.add_parser(
        "fleet-scan",
        help="Chạy nhiều kingdom scan đồng thời từ file JSON.",
    )
    fleet_scan.add_argument("job", type=Path)
    fleet_scan.add_argument("--workers", type=int)
    fleet_scan.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    fleet_scan.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    fleet_scan.add_argument("--tesseract", help="Đường dẫn tesseract.exe.")
    fleet_scan.add_argument("--tessdata", help="Thư mục chứa *.traineddata.")
    fleet_scan.add_argument("--confirm", action="store_true")

    ranking_scan = subcommands.add_parser(
        "ranking-scan",
        help="Quét đầy đủ Alliance, Honor hoặc Seed; tự cuộn và xuất dữ liệu.",
    )
    ranking_scan.add_argument("device", help="Alias hoặc ADB serial.")
    ranking_scan.add_argument("ranking_type", choices=("alliance", "honor", "seed"))
    ranking_scan.add_argument("--amount", type=int, default=100)
    ranking_scan.add_argument("--name", default="ranking")
    ranking_scan.add_argument("--formats", default="xlsx,csv,jsonl")
    ranking_scan.add_argument(
        "--evidence", choices=("all", "review", "none"), default="all"
    )
    ranking_scan.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    ranking_scan.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    ranking_scan.add_argument("--tesseract", help="Đường dẫn tesseract.exe.")
    ranking_scan.add_argument("--tessdata", help="Thư mục chứa *.traineddata.")
    ranking_scan.add_argument("--confirm", action="store_true")

    fleet_ranking = subcommands.add_parser(
        "fleet-ranking-scan",
        help="Quét Alliance/Honor/Seed đồng thời trên nhiều điện thoại.",
    )
    fleet_ranking.add_argument("job", type=Path)
    fleet_ranking.add_argument("--workers", type=int)
    fleet_ranking.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    fleet_ranking.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    fleet_ranking.add_argument("--tesseract", help="Đường dẫn tesseract.exe.")
    fleet_ranking.add_argument("--tessdata", help="Thư mục chứa *.traineddata.")
    fleet_ranking.add_argument("--confirm", action="store_true")

    agent = subcommands.add_parser(
        "agent-run",
        help="Chạy daemon nhận job từ Fleet Control và điều phối nhiều điện thoại.",
    )
    agent.add_argument("agent_config", type=Path)
    agent.add_argument("--url", help="Control URL; mặc định ROK_CONTROL_URL.")
    agent.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    agent.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    agent.add_argument("--tesseract", help="Đường dẫn tesseract.exe.")
    agent.add_argument("--tessdata", help="Thư mục chứa *.traineddata.")
    return parser


def _aliases(path: Path) -> dict[str, str]:
    return load_aliases(path)


def _serial(args: argparse.Namespace) -> str:
    return resolve_device(args.device, _aliases(args.config))


def _print_scan_progress(event: dict[str, object]) -> None:
    serial = event.get("serial", "?")
    if event.get("event") == "governor":
        review = " REVIEW" if event.get("needsReview") else ""
        print(
            f"[{serial}] {event.get('records')}/{event.get('target')} "
            f"rank={event.get('rank')} {event.get('name') or '(không đọc được tên)'}"
            f"{review}",
            file=sys.stderr,
            flush=True,
        )
    elif event.get("event") == "scroll-back":
        print(
            f"[{serial}] .. vuot qua tron (thay hang {event.get('sawTop')}, "
            f"can hang {event.get('expected')}) - lui lai",
            file=sys.stderr,
            flush=True,
        )
    elif event.get("event") == "rank-gap":
        print(
            f"[{serial}] !! BO SOT {event.get('missing')} nguoi: thu hang "
            f"{event.get('afterRank')} -> {event.get('nextRank')} (trang {event.get('page')})",
            file=sys.stderr,
            flush=True,
        )
    elif event.get("event") == "row-miss":
        # In ngay khi phat hien, mau noi bat. Ho thu hang khong lam ban quet
        # dung lai — nguoi van hanh phai thay de con quyet dinh quet lai hay
        # chap nhan.
        print(
            f"[{serial}] !! TRUOT hang {event.get('row')} trang {event.get('page')} "
            f"(luot {event.get('attempt')}) - "
            f"{'BAM NHAM NGUOI: danh sach=' + str(event.get('hintName')) + ' ho so=' + str(event.get('profileName')) if event.get('reason') == 'ten-khong-khop' else 'man hinh luc do: '}"
            f"{event.get('screen') or 'khong nhan ra'}"
            f"{'' if event.get('distance') is None else ' (lech ' + str(event.get('distance')) + ' bit)'}",
            file=sys.stderr,
            flush=True,
        )
    elif event.get("event") == "scroll":
        print(
            f"[{serial}] cuộn sau page {event.get('page')} "
            f"({event.get('records')}/{event.get('target')})",
            file=sys.stderr,
            flush=True,
        )
    elif event.get("event") == "ranking-row":
        review = " REVIEW" if event.get("needsReview") else ""
        print(
            f"[{serial}] {event.get('rankingType')} "
            f"{event.get('rank')}/{event.get('target')} "
            f"{event.get('name') or '(không đọc được tên)'} "
            f"score={event.get('score')}{review}",
            file=sys.stderr,
            flush=True,
        )


def _print_devices(client: AdbClient) -> int:
    devices = client.devices()
    if not devices:
        print("Chưa thấy thiết bị nào.")
        return 1
    print(f"{'SERIAL':<24} {'STATE':<14} {'MODEL':<24} TRANSPORT")
    for device in devices:
        print(
            f"{device.serial:<24} {device.state:<14} "
            f"{(device.model or '-'):<24} {device.transport_id or '-'}"
        )
    return 0 if all(device.ready for device in devices) else 2


def _doctor(client: AdbClient, config: Path) -> int:
    print(f"ADB: {client.path}")
    print(client.version().splitlines()[0])
    try:
        print(f"scrcpy: {find_scrcpy()}")
    except AdbError as exc:
        print(f"scrcpy: CHƯA CÓ ({exc})")
    aliases = _aliases(config)
    print(f"Cấu hình: {config} ({len(aliases)} alias)")
    if len(aliases.values()) != len(set(aliases.values())):
        print("CẢNH BÁO: Nhiều alias đang trỏ tới cùng một serial.")
        return 3
    result = _print_devices(client)

    serials = [device.serial for device in client.devices()]
    if len(serials) != len(set(serials)):
        print("CẢNH BÁO: Có thiết bị trùng serial; chưa được chạy automation.")
        return 3
    return result


def _snapshot(client: AdbClient, config: Path, output: Path | None) -> int:
    aliases = _aliases(config)
    if aliases:
        targets = aliases
    else:
        targets = {device.serial: device.serial for device in client.devices()}
    if not targets:
        raise AdbError("Chưa có thiết bị để snapshot.")

    results: dict[str, object] = {}
    workers = min(4, len(targets))
    with ThreadPoolExecutor(
        max_workers=workers, thread_name_prefix="rok-device"
    ) as pool:
        futures = {
            pool.submit(client.inspect, serial): (alias, serial)
            for alias, serial in targets.items()
        }
        for future in as_completed(futures):
            alias, serial = futures[future]
            try:
                results[alias] = {"ok": True, "data": future.result()}
            except AdbError as exc:
                results[alias] = {"ok": False, "serial": serial, "error": str(exc)}

    document = {
        "capturedAt": datetime.now().astimezone().isoformat(),
        "devices": results,
    }
    destination = output or DEFAULT_ARTIFACTS / "device-snapshot.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(destination.resolve())
    return 0 if all(item.get("ok") for item in results.values()) else 2


def _fleet_probe(client: AdbClient, profile_path: Path, artifacts: Path) -> int:
    profile = load_profile(profile_path)
    devices = [device for device in client.devices() if device.ready]
    if not devices:
        raise AdbError("Chưa có thiết bị ADB sẵn sàng để probe.")
    results: list[dict[str, object]] = []
    workers = min(4, len(devices))
    with ThreadPoolExecutor(
        max_workers=workers, thread_name_prefix="rok-probe"
    ) as pool:
        futures = {
            pool.submit(
                probe_rankings_menu, client, device.serial, profile, artifacts
            ): device.serial
            for device in devices
        }
        for future in as_completed(futures):
            serial = futures[future]
            try:
                results.append(future.result())
            except AdbError as exc:
                results.append({"ok": False, "serial": serial, "error": str(exc)})
    print(json.dumps({"devices": results}, ensure_ascii=False, indent=2))
    return 0 if all(result.get("ok") for result in results) else 2


def main(argv: list[str] | None = None) -> int:
    _configure_console()
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "upload-scan":
            result = upload_scan(args.file, api_url=args.url)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        client = AdbClient(args.adb)
        if args.command == "doctor":
            return _doctor(client, args.config)
        if args.command == "devices":
            return _print_devices(client)
        if args.command == "snapshot":
            return _snapshot(client, args.config, args.output)
        if args.command == "fleet-probe":
            return _fleet_probe(client, args.profile, args.artifacts)
        if args.command == "fleet-scan":
            result = run_fleet_job(
                client,
                load_profile(args.profile),
                args.artifacts,
                _aliases(args.config),
                load_fleet_job(args.job),
                confirmed=args.confirm,
                workers=args.workers,
                tesseract_path=args.tesseract,
                tessdata_path=args.tessdata,
                progress=_print_scan_progress,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 2
        if args.command == "fleet-ranking-scan":
            result = run_fleet_ranking_job(
                client,
                load_profile(args.profile),
                args.artifacts,
                _aliases(args.config),
                load_fleet_job(args.job),
                confirmed=args.confirm,
                workers=args.workers,
                tesseract_path=args.tesseract,
                tessdata_path=args.tessdata,
                progress=_print_scan_progress,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 2
        if args.command == "agent-run":
            DeviceAgent(
                client,
                ControlClient(args.url),
                load_profile(args.profile),
                args.artifacts,
                load_agent_config(args.agent_config),
                _aliases(args.config),
                tesseract_path=args.tesseract,
                tessdata_path=args.tessdata,
            ).run_forever()
            return 0

        serial = _serial(args)
        if args.command == "inspect":
            print(json.dumps(client.inspect(serial), ensure_ascii=False, indent=2))
        elif args.command == "screenshot":
            timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
            output = (
                args.output
                or DEFAULT_ARTIFACTS / "screenshots" / f"{args.device}-{timestamp}.png"
            )
            print(client.screenshot(serial, output).resolve())
        elif args.command == "wifi-open":
            print(client.open_wifi_settings(serial))
        elif args.command == "wifi-status":
            print(client.wifi_status(serial))
        elif args.command == "ui-dump":
            print(client.ui_dump(serial))
        elif args.command == "wake":
            print(client.keyevent(serial, "KEYCODE_WAKEUP"))
        elif args.command == "home":
            print(client.keyevent(serial, "KEYCODE_HOME"))
        elif args.command == "tap":
            print(client.tap(serial, args.x, args.y))
        elif args.command == "rankings-probe":
            result = probe_rankings_menu(
                client,
                serial,
                load_profile(args.profile),
                args.artifacts,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 2
        elif args.command == "rankings-open":
            result = open_ranking(
                client,
                serial,
                load_profile(args.profile),
                args.artifacts,
                args.ranking,
                confirmed=args.confirm,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 2
        elif args.command == "rankings-read":
            result = read_visible_power_ranking(
                client,
                serial,
                load_profile(args.profile),
                args.artifacts,
                tesseract_path=args.tesseract,
                tessdata_path=args.tessdata,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 2
        elif args.command == "kingdom-scan":
            formats = {item.strip() for item in args.formats.split(",") if item.strip()}
            if not formats or not formats <= {"xlsx", "csv", "jsonl"}:
                raise AdbError("--formats chỉ hỗ trợ xlsx,csv,jsonl.")
            result = KingdomScanner(
                client,
                serial,
                load_profile(args.profile),
                args.artifacts,
                ScanOptions(
                    kingdom=args.kingdom,
                    amount=args.amount,
                    scan_name=args.name,
                    formats=formats,
                    evidence=args.evidence,
                    scroll_duration_ms=args.scroll_duration_ms,
                    scroll_fraction=args.scroll_fraction,
                    rows_per_page=args.rows_per_page,
                    resume_directory=args.resume,
                ),
                confirmed=args.confirm,
                tesseract_path=args.tesseract,
                tessdata_path=args.tessdata,
                progress=_print_scan_progress,
            ).scan()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 2
        elif args.command == "ranking-scan":
            formats = {item.strip() for item in args.formats.split(",") if item.strip()}
            if not formats or not formats <= {"xlsx", "csv", "jsonl"}:
                raise AdbError("--formats chỉ hỗ trợ xlsx,csv,jsonl.")
            result = RankingScanner(
                client,
                serial,
                load_profile(args.profile),
                args.artifacts,
                RankingScanOptions(
                    ranking_type=args.ranking_type,
                    amount=args.amount,
                    scan_name=args.name,
                    formats=formats,
                    evidence=args.evidence,
                ),
                confirmed=args.confirm,
                tesseract_path=args.tesseract,
                tessdata_path=args.tessdata,
                progress=_print_scan_progress,
            ).scan()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["ok"] else 2
        elif args.command == "live":
            client.require_ready(serial)
            pid = launch_scrcpy(
                serial,
                args.device,
                explicit_path=args.scrcpy,
                max_size=args.max_size,
                max_fps=args.max_fps,
            )
            print(f"Đã mở scrcpy cho {args.device} ({serial}), PID {pid}.")
        return 0
    except AdbError as exc:
        print(f"LỖI: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print(
            "Đã dừng theo yêu cầu. State gần nhất đã được giữ để --resume.",
            file=sys.stderr,
        )
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
