from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from .adb import AdbClient, AdbError, load_aliases, resolve_device
from .collector import upload_scan
from .profiles import load_profile
from .ranking_reader import read_visible_power_ranking
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
        description="RokViet Device Lab — điều khiển nhiều Android an toàn theo serial.",
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
        "upload-scan", help="Gửi scan JSON đã chuẩn hóa lên RokViet Hub."
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
    return parser


def _aliases(path: Path) -> dict[str, str]:
    return load_aliases(path)


def _serial(args: argparse.Namespace) -> str:
    return resolve_device(args.device, _aliases(args.config))


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
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="rok-device") as pool:
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


def _fleet_probe(
    client: AdbClient, profile_path: Path, artifacts: Path
) -> int:
    profile = load_profile(profile_path)
    devices = [device for device in client.devices() if device.ready]
    if not devices:
        raise AdbError("Chưa có thiết bị ADB sẵn sàng để probe.")
    results: list[dict[str, object]] = []
    workers = min(4, len(devices))
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="rok-probe") as pool:
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

        serial = _serial(args)
        if args.command == "inspect":
            print(json.dumps(client.inspect(serial), ensure_ascii=False, indent=2))
        elif args.command == "screenshot":
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            output = args.output or DEFAULT_ARTIFACTS / "screenshots" / f"{args.device}-{timestamp}.png"
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


if __name__ == "__main__":
    raise SystemExit(main())
