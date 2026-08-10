"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";

type Report = { id: string; reason: string; detail: string | null; createdAt: string; reporter: { displayName: string | null; name: string | null }; topic?: { title: string } | null; reply?: { body: string; topic: { title: string } } | null };

export function ModerationReports() {
  const [status, setStatus] = useState("pending"); const [reports, setReports] = useState<Report[]>([]); const [message, setMessage] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/moderation/reports?status=${status}`); const data = await response.json(); if (response.ok) setReports(data.reports); }, [status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load updates state only after the API promise resolves.
  useEffect(() => { load().catch(() => undefined); }, [load]);
  async function resolve(id: string, next: "REVIEWED" | "DISMISSED" | "ACTION_TAKEN") { const actionTaken = next === "ACTION_TAKEN" ? window.prompt("Hành động kiểm duyệt đã thực hiện:") ?? undefined : undefined; const response = await fetch(`/api/moderation/reports/${id}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next, actionTaken }) }); setMessage(response.ok ? "Đã cập nhật báo cáo." : "Không thể cập nhật."); if (response.ok) await load(); }
  return <><div className="tabs"><button className={status === "pending" ? "active" : ""} onClick={() => setStatus("pending")}>Chờ xử lý</button><button className={status === "reviewed" ? "active" : ""} onClick={() => setStatus("reviewed")}>Đã xem</button><button className={status === "dismissed" ? "active" : ""} onClick={() => setStatus("dismissed")}>Bỏ qua</button><button className={status === "action_taken" ? "active" : ""} onClick={() => setStatus("action_taken")}>Đã xử lý</button></div>{message && <p className="forum-notice">{message}</p>}<div className="moderation-list">{reports.map((report) => <Card className="moderation-card" key={report.id}><strong>{report.reason} · {report.topic?.title ?? report.reply?.topic.title}</strong><p>{report.detail ?? "Không có ghi chú"}</p><small>Bởi {report.reporter.displayName ?? report.reporter.name} · {new Date(report.createdAt).toLocaleString("vi-VN")}</small><div className="forum-actions"><button onClick={() => resolve(report.id, "REVIEWED")}>Reviewed</button><button onClick={() => resolve(report.id, "DISMISSED")}>Dismissed</button><button onClick={() => resolve(report.id, "ACTION_TAKEN")}>Action Taken</button></div></Card>)}</div></>;
}
