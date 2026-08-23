"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";

type Result = { id: string; slug: string; title: string; body: string; replyCount: number; author: { displayName: string | null; name: string | null }; category: { slug: string } };

export function SearchResults({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery); const [submitted, setSubmitted] = useState(initialQuery); const [page, setPage] = useState(1); const [data, setData] = useState<{ topics: Result[]; pages: number; total: number } | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { setError(""); if (submitted.trim().length < 2) { setData(null); return; } const response = await fetch(`/api/forum/search?q=${encodeURIComponent(submitted)}&page=${page}`); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }, [page, submitted]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load updates state only after the API promise resolves.
  useEffect(() => { load().catch((reason: Error) => setError(reason.message)); }, [load]);
  return <div className="shell page narrow-page"><div className="page-intro"><p className="eyebrow">FORUM SEARCH</p><h1>Tìm kiếm thảo luận</h1></div><form className="search forum-search-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(query); setPage(1); }}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} required /><button>Tìm</button></form>{error && <p className="forum-error">{error}</p>}<p>{data ? `${data.total} kết quả` : "Nhập ít nhất 2 ký tự."}</p><div className="forum-topic-list">{data?.topics.map((item) => <Link key={item.id} href={`/forum/topic/${item.slug}`}><Card className="forum-topic-row"><div><h2>{item.title}</h2><p>{item.author.displayName ?? item.author.name ?? "Thành viên"} · {item.category.slug}</p><p>{item.body.slice(0, 180)}…</p></div><strong>{item.replyCount} trả lời</strong></Card></Link>)}</div>{data && data.pages > 1 && <div className="forum-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>←</button><span>{page}/{data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)}>→</button></div>}</div>;
}
