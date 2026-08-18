"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Character = { id: string; key: string; label: string; kingdomNumber: number; status: string };
type Device = { id: string; serial: string; alias: string; model: string | null; status: string; adbState: string | null; batteryPercent: number | null; currentCharacterKey: string | null; lastHeartbeatAt: string | null; lastError: string | null; characters: Character[] };
type Agent = { id: string; name: string; hostname: string; version: string; status: string; lastHeartbeatAt: string | null };
type Job = { id: string; type: string; status: string; kingdomNumber: number; amount: number; priority: number; scanName: string; progress: Record<string, unknown> | null; error: string | null; createdAt: string; assignedDevice: { alias: string; serial: string } | null; character: { label: string; key: string } | null };
type Policy = { id: string; kingdomNumber: number; enabled: boolean; fullScan: boolean; amount: number; cadenceMinutes: number; priority: number; activeKvk: boolean; nextScanAt: string };
type FleetData = { agents: Agent[]; devices: Device[]; jobs: Job[]; policies: Policy[] };

const empty: FleetData = { agents: [], devices: [], jobs: [], policies: [] };

function age(value: string | null) {
  if (!value) return "chưa kết nối";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s trước` : `${Math.round(seconds / 60)} phút trước`;
}

export function FleetControl({ canConfigure }: { canConfigure: boolean }) {
  const [data, setData] = useState<FleetData>(empty);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState({ type: "RANKING_SEED", kingdomNumber: "2812", amount: "300", priority: "100", scanName: "manual-kd2812", serial: "" });
  const [policy, setPolicy] = useState({ kingdomNumber: "2812", cadenceMinutes: "10080", priority: "100", amount: "300", activeKvk: false, fullScan: false });
  const [character, setCharacter] = useState({ serial: "", key: "kd2812-main", label: "KD 2812", kingdomNumber: "2812", governorId: "", switchOrder: "0", switchRoute: '{\n  "steps": [],\n  "finalScreen": "city-kd2812"\n}', scanRoutes: "{}" });
  const [catalog, setCatalog] = useState({ from: "1001", to: "4200", cadenceMinutes: "43200" });

  const refresh = useCallback(async () => {
    const response = await fetch("/api/ops/fleet", { cache: "no-store" });
    if (response.ok) setData(await response.json());
    setLoading(false);
  }, []);
  useEffect(() => {
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 5_000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);

  async function send(url: string, method: "POST" | "PUT", body?: object) {
    setMessage("");
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Đã cập nhật control plane." : payload.error ?? "Thao tác thất bại.");
    if (response.ok) await refresh();
    return response.ok;
  }

  const activeJobs = useMemo(() => data.jobs.filter((item) => !["COMPLETED", "FAILED", "CANCELLED"].includes(item.status)), [data.jobs]);
  const readyDevices = data.devices.filter((item) => item.status === "READY").length;
  return <div className="shell data-stack fleet-console">
    <div className="fleet-metrics">
      <article><span>AGENTS</span><strong>{data.agents.length}</strong><small>{data.agents.filter((item) => item.status === "ONLINE").length} online</small></article>
      <article><span>DEVICES</span><strong>{data.devices.length}</strong><small>{readyDevices} ready</small></article>
      <article><span>CHARACTERS</span><strong>{data.devices.reduce((sum, item) => sum + item.characters.length, 0)}</strong><small>đã ánh xạ Kingdom</small></article>
      <article><span>QUEUE</span><strong>{activeJobs.length}</strong><small>job chưa kết thúc</small></article>
    </div>
    <div className="ops-warning">Cổng nội bộ. Không mở 3031 ra Internet; dùng SSH tunnel hoặc Tailscale ACL. Token agent không nhập vào trình duyệt.</div>
    {message ? <p className="service-message">{message}</p> : null}

    <section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">USB FLEET</span><h2>Điện thoại và character</h2><p>{loading ? "Đang tải…" : "Tự cập nhật mỗi 5 giây"}</p></div><span className="live-pill"><i /> {readyDevices} READY</span></div>
      <div className="device-grid">{data.devices.length ? data.devices.map((device) => <article className="device-card" key={device.id}>
        <div className="device-head"><span className={`device-state state-${device.status.toLowerCase()}`}>{device.status}</span><small>{age(device.lastHeartbeatAt)}</small></div>
        <h3>{device.alias}</h3><code>{device.serial}</code><p>{device.model ?? "Android"} · ADB {device.adbState ?? "?"} · 🔋 {device.batteryPercent ?? "?"}%</p>
        <div className="character-list">{device.characters.map((item) => <span key={item.id} className={item.key === device.currentCharacterKey ? "current" : ""}>KD {item.kingdomNumber} · {item.label}<b>{item.status}</b></span>)}{!device.characters.length ? <em>Chưa cấu hình character</em> : null}</div>
        {device.lastError ? <small className="fleet-error">{device.lastError}</small> : null}
      </article>) : <p className="empty-data">Chạy device agent để điện thoại heartbeat vào đây.</p>}</div>
    </section>

    {canConfigure ? <section className="fleet-forms">
      <form className="data-panel fleet-form" onSubmit={(event) => { event.preventDefault(); send("/api/ops/fleet/jobs", "POST", { ...job, kingdomNumber: Number(job.kingdomNumber), amount: Number(job.amount), priority: Number(job.priority), serial: job.serial || undefined }); }}><div className="panel-heading"><div><span className="panel-kicker">MANUAL JOB</span><h2>Tạo job quét</h2></div></div><div className="form-body">
        <label>Loại<select value={job.type} onChange={(e) => setJob({ ...job, type: e.target.value })}><option>RANKING_SEED</option><option>KINGDOM_FULL</option><option>RANKING_ALLIANCE</option><option>RANKING_HONOR</option><option>KVK_DISCOVERY</option></select></label>
        <label>Kingdom<input value={job.kingdomNumber} onChange={(e) => setJob({ ...job, kingdomNumber: e.target.value })} /></label><label>Số người<input value={job.amount} onChange={(e) => setJob({ ...job, amount: e.target.value })} /></label><label>Ưu tiên<input value={job.priority} onChange={(e) => setJob({ ...job, priority: e.target.value })} /></label><label>Tên scan<input value={job.scanName} onChange={(e) => setJob({ ...job, scanName: e.target.value })} /></label><label>Serial tùy chọn<select value={job.serial} onChange={(e) => setJob({ ...job, serial: e.target.value })}><option value="">Scheduler tự chọn</option>{data.devices.map((item) => <option key={item.id} value={item.serial}>{item.alias}</option>)}</select></label><button className="button">Đưa vào queue</button>
      </div></form>
      <form className="data-panel fleet-form" onSubmit={(event) => { event.preventDefault(); send("/api/ops/fleet/policies", "POST", { ...policy, kingdomNumber: Number(policy.kingdomNumber), cadenceMinutes: Number(policy.cadenceMinutes), priority: Number(policy.priority), amount: Number(policy.amount) }); }}><div className="panel-heading"><div><span className="panel-kicker">SCHEDULER</span><h2>Lịch Kingdom</h2></div></div><div className="form-body">
        <label>Kingdom<input value={policy.kingdomNumber} onChange={(e) => setPolicy({ ...policy, kingdomNumber: e.target.value })} /></label><label>Chu kỳ (phút)<input value={policy.cadenceMinutes} onChange={(e) => setPolicy({ ...policy, cadenceMinutes: e.target.value })} /></label><label>Ưu tiên<input value={policy.priority} onChange={(e) => setPolicy({ ...policy, priority: e.target.value })} /></label><label>Số người<input value={policy.amount} onChange={(e) => setPolicy({ ...policy, amount: e.target.value })} /></label><label className="check-line"><input type="checkbox" checked={policy.activeKvk} onChange={(e) => setPolicy({ ...policy, activeKvk: e.target.checked })} /> Đang KvK</label><label className="check-line"><input type="checkbox" checked={policy.fullScan} onChange={(e) => setPolicy({ ...policy, fullScan: e.target.checked })} /> Full profile</label><button className="button">Lưu lịch</button><button type="button" onClick={() => send("/api/ops/fleet/policies", "PUT")}>Chạy scheduler ngay</button>
      </div></form>
      <form className="data-panel fleet-form character-form" onSubmit={(event) => { event.preventDefault(); let switchRoute; let scanRoutes; try { switchRoute = JSON.parse(character.switchRoute); scanRoutes = JSON.parse(character.scanRoutes); } catch { return setMessage("Route JSON không hợp lệ."); } send("/api/ops/fleet/characters", "POST", { ...character, kingdomNumber: Number(character.kingdomNumber), switchOrder: Number(character.switchOrder), switchRoute, scanRoutes, accountLabel: undefined }); }}><div className="panel-heading"><div><span className="panel-kicker">CHARACTER ROUTE</span><h2>Ánh xạ nhân vật</h2></div></div><div className="form-body">
        <label>Thiết bị<select value={character.serial} onChange={(e) => setCharacter({ ...character, serial: e.target.value })}><option value="">Chọn điện thoại</option>{data.devices.map((item) => <option key={item.id} value={item.serial}>{item.alias}</option>)}</select></label><label>Key<input value={character.key} onChange={(e) => setCharacter({ ...character, key: e.target.value })} /></label><label>Nhãn<input value={character.label} onChange={(e) => setCharacter({ ...character, label: e.target.value })} /></label><label>Kingdom<input value={character.kingdomNumber} onChange={(e) => setCharacter({ ...character, kingdomNumber: e.target.value })} /></label><label>Governor ID<input value={character.governorId} onChange={(e) => setCharacter({ ...character, governorId: e.target.value })} /></label><label>Thứ tự<input value={character.switchOrder} onChange={(e) => setCharacter({ ...character, switchOrder: e.target.value })} /></label><label className="route-field">Route chọn character<textarea value={character.switchRoute} onChange={(e) => setCharacter({ ...character, switchRoute: e.target.value })} /></label><label className="route-field">Routes mở màn quét theo loại job<textarea value={character.scanRoutes} onChange={(e) => setCharacter({ ...character, scanRoutes: e.target.value })} placeholder={'{"RANKING_SEED":{"steps":[...],"finalScreen":"seed-ranking"}}'} /></label><button className="button">Lưu và chờ xác minh</button>
      </div></form>
      <form className="data-panel fleet-form" onSubmit={(event) => { event.preventDefault(); send("/api/ops/fleet/policies/bootstrap", "POST", { from: Number(catalog.from), to: Number(catalog.to), cadenceMinutes: Number(catalog.cadenceMinutes) }); }}><div className="panel-heading"><div><span className="panel-kicker">BASE CATALOG</span><h2>Khởi tạo dải Kingdom</h2><p>Chỉ tạo danh mục và policy; không tạo số liệu giả.</p></div></div><div className="form-body"><label>Từ KD<input value={catalog.from} onChange={(e) => setCatalog({ ...catalog, from: e.target.value })} /></label><label>Đến KD<input value={catalog.to} onChange={(e) => setCatalog({ ...catalog, to: e.target.value })} /></label><label>Chu kỳ nền (phút)<input value={catalog.cadenceMinutes} onChange={(e) => setCatalog({ ...catalog, cadenceMinutes: e.target.value })} /></label><button className="button">Tạo catalog/policy</button></div></form>
    </section> : null}

    <section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">AUTOMATION QUEUE</span><h2>Job gần đây</h2></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Trạng thái</th><th>Job</th><th>Kingdom</th><th>Thiết bị</th><th>Character</th><th>Tiến độ</th><th>Lỗi</th></tr></thead><tbody>{data.jobs.map((item) => <tr key={item.id}><td><span className="scan-status">{item.status}</span></td><td><code>{item.scanName}</code><small className="table-sub">{item.type}</small></td><td>KD {item.kingdomNumber}</td><td>{item.assignedDevice?.alias ?? "auto"}</td><td>{item.character?.label ?? "chưa chọn"}</td><td>{item.progress ? JSON.stringify(item.progress) : "—"}</td><td className="fleet-error">{item.error ?? "—"}</td></tr>)}</tbody></table></div></section>
    <section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">COVERAGE POLICIES</span><h2>Lịch dữ liệu nền</h2></div></div><div className="policy-chips">{data.policies.map((item) => <span key={item.id} className={item.activeKvk ? "kvk" : ""}>KD {item.kingdomNumber}<b>{item.fullScan ? "FULL" : "SEED"}</b><small>{Math.round(item.cadenceMinutes / 60)}h · {new Date(item.nextScanAt).toLocaleString("vi-VN")}</small></span>)}</div></section>
  </div>;
}
