"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useLocale } from "@/i18n/provider";

type Topic = { id: string; slug: string; title: string; upvoteCount: number; downvoteCount: number; replyCount: number; viewCount: number; updatedAt: string; isPinned: boolean; isLocked: boolean; acceptedReplyId: string | null; author: { displayName: string | null; name: string | null }; tags: Array<{ slug: string; isVerified: boolean }> };
type Payload = { page: number; pages: number; total: number; topics: Topic[] };
type Category = { slug: string; name: Record<"vi" | "en", string> };

export function CategoryTopics({ category, signedIn, verified }: { category: string; signedIn: boolean; verified: boolean }) {
  const { locale } = useLocale();
  const [sort, setSort] = useState<"latest" | "top" | "unanswered">("latest"); const [tag, setTag] = useState(""); const [page, setPage] = useState(1); const [data, setData] = useState<Payload | null>(null); const [categoryData, setCategoryData] = useState<Category | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError(""); const params = new URLSearchParams({ category, page: String(page), sort }); if (tag) params.set("tag", tag);
    const [topicsResponse, categoriesResponse] = await Promise.all([fetch(`/api/forum/topics?${params}`), fetch("/api/forum/categories")]);
    const topics = await topicsResponse.json(); if (!topicsResponse.ok) throw new Error(topics.error); setData(topics);
    if (categoriesResponse.ok) { const categories = await categoriesResponse.json() as Category[]; setCategoryData(categories.find((item) => item.slug === category) ?? null); }
  }, [category, page, sort, tag]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load updates state only after the API promises resolve.
  useEffect(() => { load().catch((reason: Error) => setError(reason.message)); }, [load]);
  return <div className="shell page"><div className="section-heading forum-category-head"><div><p className="eyebrow">FORUM</p><h1>{categoryData?.name[locale] ?? category.replaceAll("-", " ")}</h1><p>{data?.total ?? 0} chủ đề</p></div>{verified ? <Link className="button" href={`/forum/new?category=${encodeURIComponent(category)}`}>Tạo chủ đề</Link> : signedIn ? <span className="forum-notice">Xác thực email để đăng bài</span> : <Link className="button secondary" href="/auth/signin">Đăng nhập</Link>}</div>
    <div className="forum-filters"><div className="tabs"><button className={sort === "latest" ? "active" : ""} onClick={() => { setSort("latest"); setPage(1); }}>Mới nhất</button><button className={sort === "top" ? "active" : ""} onClick={() => { setSort("top"); setPage(1); }}>Nhiều vote</button><button className={sort === "unanswered" ? "active" : ""} onClick={() => { setSort("unanswered"); setPage(1); }}>Chưa trả lời</button></div><input value={tag} onChange={(event) => { setTag(event.target.value.trim()); setPage(1); }} placeholder="Lọc theo tag" /></div>
    {error && <p className="forum-error" role="alert">{error}</p>}
    <div className="forum-topic-list">{data?.topics.map((topic) => <Link key={topic.id} href={`/forum/topic/${topic.slug}`}><Card className="forum-topic-row"><div><div className="forum-badges">{topic.isPinned && <span>Đã ghim</span>}{topic.isLocked && <span>Đã khóa</span>}{topic.acceptedReplyId && <span>Đã có câu trả lời</span>}</div><h2>{topic.title}</h2><p>{topic.author.displayName ?? topic.author.name ?? "Thành viên"} · {new Date(topic.updatedAt).toLocaleString("vi-VN")}</p><div className="forum-tags">{topic.tags.map((item) => <span key={item.slug}>{item.slug}{item.isVerified ? " ✓" : ""}</span>)}</div></div><dl><div><dt>Vote</dt><dd>{topic.upvoteCount - topic.downvoteCount}</dd></div><div><dt>Trả lời</dt><dd>{topic.replyCount}</dd></div><div><dt>Lượt xem</dt><dd>{topic.viewCount}</dd></div></dl></Card></Link>)}</div>
    {data && data.pages > 1 && <div className="forum-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Trước</button><span>{page}/{data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)}>Sau →</button></div>}
  </div>;
}
