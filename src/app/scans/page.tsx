import type { Metadata } from "next";
import { scanRuns } from "@/data/kingdom-demo";

export const metadata: Metadata = { title: "Các lượt quét" };

const steps = [
  ["01", "Điện thoại", "ADB worker chụp màn hình và gắn device ID"],
  ["02", "OCR & chuẩn hóa", "Tách ID, tên, power, KP, kills và ảnh nguồn"],
  ["03", "Ingestion API", "Ký token, chống gửi trùng và lưu batch PostgreSQL"],
  ["04", "Xác minh", "Đánh dấu độ tin cậy trước khi công khai"],
];

export default function ScansPage() {
  return <div className="data-page"><section className="data-hero compact-hero"><div className="shell data-hero-inner"><div><span className="data-eyebrow"><i /> DATA PIPELINE</span><h1>Từ màn hình điện thoại<br/><em>đến dữ liệu cộng đồng</em></h1><p>Mỗi chỉ số phải truy ngược được về thiết bị, thời gian quét và ảnh bằng chứng.</p></div><div className="scanner-visual"><span className="phone-frame"><i/><b>OCR</b><small>phone01</small></span><span className="flow-line">·····▶</span><span className="database-frame">DB<small>verified</small></span></div></div></section>
    <div className="shell data-stack"><section className="pipeline-steps">{steps.map(([number, title, body]) => <article key={number}><span>{number}</span><i/><h2>{title}</h2><p>{body}</p></article>)}</section><section className="data-panel"><div className="panel-heading"><div><span className="panel-kicker">SCAN HISTORY</span><h2>Các lượt quét gần đây</h2><p>Dữ liệu minh họa cho dashboard vận hành collector.</p></div><span className="live-pill"><i/> 2 DEVICES</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Batch ID</th><th>Thiết bị</th><th>Kingdom</th><th>Hồ sơ</th><th>Ảnh</th><th>Thời gian</th><th>Trạng thái</th><th>Bắt đầu</th></tr></thead><tbody>{scanRuns.map((scan) => <tr key={scan.id}><td><code>{scan.id}</code></td><td><span className="device-pill">● {scan.device}</span></td><td><strong>KD {scan.kingdom}</strong></td><td>{scan.rows}</td><td>{scan.images}</td><td>{scan.duration}</td><td><span className={`scan-status status-${scan.status.replaceAll(" ", "-").toLowerCase()}`}>{scan.status}</span></td><td>{scan.createdAt}</td></tr>)}</tbody></table></div></section></div>
  </div>;
}
