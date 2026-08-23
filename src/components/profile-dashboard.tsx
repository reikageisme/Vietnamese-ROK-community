"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui";

type TopicLink = { id: string; slug: string; title: string; category: { slug: string }; updatedAt: string };

export function ProfileDashboard({ user, bookmarks, subscriptions }: {
  user: { id: string; displayName: string; email: string | null; locale: "vi" | "en"; role: string; reputation: number; joinedAt: string };
  bookmarks: TopicLink[];
  subscriptions: TopicLink[];
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [locale, setLocale] = useState(user.locale);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName, locale }) });
    const result = await response.json(); setBusy(false);
    setMessage(response.ok ? "Đã lưu hồ sơ." : result.error ?? "Không thể lưu hồ sơ.");
  }
  function TopicList({ items, empty }: { items: TopicLink[]; empty: string }) {
    return items.length ? <div className="profile-topic-list">{items.map((topic) => <Link key={topic.id} href={`/forum/topic/${topic.slug}`}><strong>{topic.title}</strong><small>{topic.category.slug} · {new Date(topic.updatedAt).toLocaleDateString("vi-VN")}</small></Link>)}</div> : <p className="empty-state">{empty}</p>;
  }
  return <div className="profile-dashboard">
    <section className="profile-summary card"><div className="profile-avatar">{displayName.slice(0, 1).toUpperCase()}</div><div><span>{user.role}</span><h1>{displayName}</h1><p>{user.email ?? "Tài khoản Google"} · tham gia {new Date(user.joinedAt).toLocaleDateString("vi-VN")}</p></div><strong>{user.reputation}<small> reputation</small></strong></section>
    <div className="profile-grid"><Card className="profile-settings"><h2>Hồ sơ cộng đồng</h2><form onSubmit={save}><label>Tên hiển thị<input value={displayName} minLength={2} maxLength={50} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Ngôn ngữ<select value={locale} onChange={(event) => setLocale(event.target.value as "vi" | "en")}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>{message && <p className="forum-notice">{message}</p>}<button className="button" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></form><div className="profile-links"><Link href={`/profile/${user.id}/activity`}>Bài viết và hoạt động</Link><Link href="/profile/security">Bảo mật đăng nhập</Link></div></Card>
      <Card className="profile-collection"><h2>Chủ đề đã lưu</h2><TopicList items={bookmarks} empty="Bạn chưa lưu chủ đề nào." /></Card>
      <Card className="profile-collection"><h2>Đang theo dõi</h2><TopicList items={subscriptions} empty="Bạn chưa theo dõi chủ đề nào." /></Card></div>
  </div>;
}
