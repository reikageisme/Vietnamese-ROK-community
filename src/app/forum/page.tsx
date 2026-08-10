"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useLocale } from "@/i18n/provider";

type Category = { slug: string; name: Record<"vi" | "en", string>; description: Partial<Record<"vi" | "en", string>>; topicCount: number; lastActivityAt: string | null; icon?: string | null };

export default function ForumPage() {
  const { locale, t } = useLocale(); const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/forum/categories").then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error); setCategories(json); }).catch((reason: Error) => setError(reason.message)); }, []);
  return <div className="shell page"><div className="page-intro"><p className="eyebrow">COMMUNITY FORUM</p><h1>{t.forumTitle}</h1><p>{t.forumBody}</p></div><form className="search" action="/forum/search"><span aria-hidden>⌕</span><input name="q" placeholder={t.searchForum} aria-label={t.searchForum} /></form>{error && <p className="forum-error">{error}</p>}<div className="category-list">{categories.map((category, index) => <Link href={`/forum/${category.slug}`} key={category.slug}><Card className="category-card"><span className="category-index">{category.icon ?? String(index + 1).padStart(2, "0")}</span><div className="category-copy"><h2>{category.name[locale]}</h2><p>{category.description[locale]}</p></div><div className="category-meta"><strong>{category.topicCount}</strong><span>{t.topics}</span><small>{category.lastActivityAt ? new Date(category.lastActivityAt).toLocaleDateString("vi-VN") : "Chưa có bài"}</small></div><span className="category-arrow">→</span></Card></Link>)}</div></div>;
}
