"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Notification = { id: string; type: string; isRead: boolean; createdAt: string; topic?: { slug: string; title: string } | null; actor?: { displayName: string | null; name: string | null } | null };

const labels: Record<string, string> = {
  REPLY_TO_TOPIC: "đã trả lời chủ đề", REPLY_TO_YOUR_REPLY: "đã trả lời bạn", MENTION: "đã nhắc đến bạn",
  ACCEPTED_ANSWER: "đã chọn câu trả lời của bạn", REPORT_RESOLVED: "đã xử lý báo cáo", MODERATION_ACTION: "đã thực hiện kiểm duyệt",
};

export function NotificationBell() {
  const [data, setData] = useState<{ unreadCount: number; notifications: Notification[] }>({ unreadCount: 0, notifications: [] });
  useEffect(() => { fetch("/api/notifications").then((response) => response.ok ? response.json() : null).then((value) => { if (value) setData(value); }).catch(() => undefined); }, []);
  async function read(item: Notification) { if (!item.isRead) { await fetch(`/api/notifications/${item.id}/read`, { method: "POST" }); setData((current) => ({ unreadCount: Math.max(0, current.unreadCount - 1), notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry) })); } }
  async function readAll() { await fetch("/api/notifications/read-all", { method: "POST" }); setData((current) => ({ unreadCount: 0, notifications: current.notifications.map((item) => ({ ...item, isRead: true })) })); }
  return <details className="notification-bell"><summary aria-label="Thông báo">🔔{data.unreadCount ? <b>{data.unreadCount > 99 ? "99+" : data.unreadCount}</b> : null}</summary><div className="notification-dropdown"><div className="notification-head"><strong>Thông báo</strong><button onClick={readAll}>Đọc tất cả</button></div>{data.notifications.length ? data.notifications.map((item) => <Link className={item.isRead ? "" : "unread"} key={item.id} href={item.topic ? `/forum/topic/${item.topic.slug}` : "/forum"} onClick={() => read(item)}><span><strong>{item.actor?.displayName ?? item.actor?.name ?? "Hệ thống"}</strong> {labels[item.type] ?? "đã cập nhật nội dung"}</span><small>{item.topic?.title ?? new Date(item.createdAt).toLocaleString("vi-VN")}</small></Link>) : <p>Chưa có thông báo.</p>}</div></details>;
}
