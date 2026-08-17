"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PortalData = {
  balance: number;
  requests: Array<{ id: string; requestCode: string; kingdomNumber: number; product: string; costCredits: number; status: string; createdAt: string }>;
  topUps: Array<{ id: string; amountVnd: number; credits: number; transferReference: string; status: string; createdAt: string }>;
};

const products = [
  { id: "KINGDOM_OVERVIEW", name: "Tổng quan Kingdom", credits: 50, description: "Power, KP, dead và ảnh tổng quan." },
  { id: "GOVERNOR_TOP_300", name: "Top 300 thống đốc", credits: 120, description: "Danh sách 300 hồ sơ và chỉ số chính." },
  { id: "KVK_CAMP", name: "Bản đồ trại KvK", credits: 250, description: "Nhóm kingdom theo trại và tổng hợp KvK." },
] as const;

const topups = [{ amount: 50000, credits: 50 }, { amount: 100000, credits: 110 }, { amount: 200000, credits: 240 }] as const;
const labels: Record<string, string> = { QUEUED: "Đã nhận", ASSIGNED: "Đã xếp máy", RUNNING: "Đang quét", REVIEWING: "Đang kiểm tra", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", REFUNDED: "Đã hoàn credit", PENDING: "Chờ xác nhận", APPROVED: "Đã cộng credit", REJECTED: "Từ chối" };

export function ScanServicePortal({ signedIn }: { signedIn: boolean }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<(typeof products)[number]["id"]>("KINGDOM_OVERVIEW");
  const [kingdom, setKingdom] = useState("");
  const [amount, setAmount] = useState(50000);
  const [reference, setReference] = useState("");

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    const response = await fetch("/api/scan-service", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/scan-service", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (!cancelled && payload) setData(payload); });
    return () => { cancelled = true; };
  }, [signedIn]);

  async function send(url: string, body: object) {
    setBusy(true); setMessage("");
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? "Không thể xử lý yêu cầu.");
    setMessage("Đã ghi nhận thành công.");
    setReference("");
    await refresh();
  }

  if (!signedIn) return <section className="service-login"><h2>Đăng nhập để yêu cầu quét</h2><p>Số dư, đơn quét và giao dịch chỉ hiển thị cho chính chủ tài khoản.</p><Link className="button" href="/auth/signin?callbackUrl=/scans">Đăng nhập / đăng ký</Link></section>;
  return <div className="scan-service-grid">
    <section className="credit-summary"><span>SỐ DƯ KHẢ DỤNG</span><strong>{data?.balance ?? 0} <small>credit</small></strong><p>Mỗi đơn chỉ trừ credit khi bạn xác nhận gửi yêu cầu.</p></section>
    <section className="service-card"><div className="panel-heading"><div><span className="panel-kicker">NEW SCAN</span><h2>Yêu cầu quét mới</h2></div></div><label>Kingdom<input inputMode="numeric" placeholder="Ví dụ: 2812" value={kingdom} onChange={(event) => setKingdom(event.target.value)} /></label><div className="product-options">{products.map((item) => <button type="button" className={product === item.id ? "selected" : ""} key={item.id} onClick={() => setProduct(item.id)}><strong>{item.name}</strong><span>{item.description}</span><b>{item.credits} credit</b></button>)}</div><button className="button" disabled={busy || !kingdom} onClick={() => send("/api/scan-service/requests", { kingdomNumber: kingdom, product })}>Gửi yêu cầu quét</button></section>
    <section className="service-card"><div className="panel-heading"><div><span className="panel-kicker">TOP UP</span><h2>Nạp credit</h2><p>Chuyển khoản theo hướng dẫn của quản trị viên, sau đó gửi mã giao dịch để đối soát.</p></div></div><div className="topup-options">{topups.map((item) => <button type="button" className={amount === item.amount ? "selected" : ""} key={item.amount} onClick={() => setAmount(item.amount)}><strong>{item.amount.toLocaleString("vi-VN")}đ</strong><span>{item.credits} credit</span></button>)}</div><label>Mã giao dịch / nội dung chuyển khoản<input placeholder="Ví dụ: FT123456789" value={reference} onChange={(event) => setReference(event.target.value)} /></label><button className="button button-secondary" disabled={busy || reference.trim().length < 4} onClick={() => send("/api/scan-service/topups", { amountVnd: amount, transferReference: reference })}>Gửi phiếu xác nhận nạp</button><small className="payment-warning">Hệ thống chưa tự thu tiền. Quản trị viên chỉ cộng credit sau khi đối chiếu giao dịch thật.</small></section>
    {message ? <p className="service-message">{message}</p> : null}
    <section className="service-card service-history"><h2>Đơn quét của tôi</h2>{data?.requests.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Mã đơn</th><th>Kingdom</th><th>Gói</th><th>Chi phí</th><th>Trạng thái</th></tr></thead><tbody>{data.requests.map((item) => <tr key={item.id}><td><code>{item.requestCode}</code></td><td>KD {item.kingdomNumber}</td><td>{products.find((p) => p.id === item.product)?.name}</td><td>{item.costCredits} credit</td><td><span className="scan-status">{labels[item.status] ?? item.status}</span></td></tr>)}</tbody></table></div> : <p>Chưa có đơn quét nào.</p>}</section>
    <section className="service-card service-history"><h2>Phiếu nạp gần đây</h2>{data?.topUps.length ? <div className="topup-history">{data.topUps.map((item) => <div key={item.id}><span>{item.amountVnd.toLocaleString("vi-VN")}đ · {item.transferReference}</span><b>{item.credits} credit · {labels[item.status] ?? item.status}</b></div>)}</div> : <p>Chưa có phiếu nạp nào.</p>}</section>
  </div>;
}
