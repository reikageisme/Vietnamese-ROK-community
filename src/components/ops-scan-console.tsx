"use client";

import { useState } from "react";

type TopUp = { id: string; amountVnd: number; credits: number; transferReference: string; requester: { email: string | null; displayName: string | null; name: string | null } };
type ScanRequest = { id: string; requestCode: string; kingdomNumber: number; product: string; costCredits: number; status: string; assignedDeviceId: string | null; requester: { email: string | null; displayName: string | null; name: string | null } };
type Batch = { id: string; externalId: string; deviceId: string; status: string; recordCount: number; capturedAt: string; kingdom: { number: number } };

export function OpsScanConsole({ initialTopUps, initialRequests, initialBatches }: { initialTopUps: TopUp[]; initialRequests: ScanRequest[]; initialBatches: Batch[] }) {
  const [topUps, setTopUps] = useState(initialTopUps);
  const [requests, setRequests] = useState(initialRequests);
  const [message, setMessage] = useState("");
  async function post(url: string, body: object) {
    setMessage("");
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "Thao tác thất bại.");
    setMessage("Đã cập nhật.");
    return true;
  }
  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    if (await post(`/api/ops/topups/${id}`, { decision })) setTopUps((current) => current.filter((item) => item.id !== id));
  }
  async function advance(item: ScanRequest, status: string) {
    if (await post(`/api/ops/scan-requests/${item.id}`, { status, assignedDeviceId: item.assignedDeviceId ?? "phone01" })) setRequests((current) => current.map((request) => request.id === item.id ? { ...request, status } : request));
  }
  return <div className="shell data-stack ops-console">
    <div className="ops-warning">NỘI BỘ · Không chia sẻ URL hoặc ảnh màn hình có dữ liệu thiết bị.</div>{message ? <p className="service-message">{message}</p> : null}
    <section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">PAYMENT REVIEW</span><h2>Phiếu nạp chờ đối soát</h2></div><span className="live-pill">{topUps.length} PENDING</span></div>{topUps.length ? <div className="ops-list">{topUps.map((item) => <article key={item.id}><div><strong>{item.requester.displayName ?? item.requester.name ?? item.requester.email}</strong><p>{item.amountVnd.toLocaleString("vi-VN")}đ → {item.credits} credit · <code>{item.transferReference}</code></p></div><div><button onClick={() => review(item.id, "REJECTED")}>Từ chối</button><button className="button button-small" onClick={() => review(item.id, "APPROVED")}>Xác nhận đã nhận tiền</button></div></article>)}</div> : <p className="empty-state">Không có phiếu chờ duyệt.</p>}</section>
    <section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">SCAN QUEUE</span><h2>Hàng đợi đơn quét</h2></div></div><div className="ops-list">{requests.map((item) => <article key={item.id}><div><strong>{item.requestCode} · KD {item.kingdomNumber}</strong><p>{item.product} · {item.requester.email} · {item.status}</p></div><div className="ops-actions">{item.status === "QUEUED" ? <button onClick={() => advance(item, "ASSIGNED")}>Xếp phone01</button> : null}{item.status === "ASSIGNED" ? <button onClick={() => advance(item, "RUNNING")}>Bắt đầu</button> : null}{item.status === "RUNNING" ? <button onClick={() => advance(item, "REVIEWING")}>Kiểm tra</button> : null}{item.status === "REVIEWING" ? <button className="button button-small" onClick={() => advance(item, "COMPLETED")}>Hoàn thành</button> : null}{!["COMPLETED", "REFUNDED"].includes(item.status) ? <button onClick={() => advance(item, "REFUNDED")}>Hoàn credit</button> : null}</div></article>)}</div></section>
    <section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">COLLECTOR</span><h2>Batch thiết bị gần đây</h2></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Batch</th><th>Thiết bị</th><th>Kingdom</th><th>Hồ sơ</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>{initialBatches.map((item) => <tr key={item.id}><td><code>{item.externalId}</code></td><td>{item.deviceId}</td><td>KD {item.kingdom.number}</td><td>{item.recordCount}</td><td>{item.status}</td><td>{new Date(item.capturedAt).toLocaleString("vi-VN")}</td></tr>)}</tbody></table></div></section>
  </div>;
}
