"use client";

import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { codexEntries } from "@/data/mock-data";
import { useLocale } from "@/i18n/provider";

export default function CodexPage() {
  const { locale, t } = useLocale();
  const [tab, setTab] = useState("commander");
  const [query, setQuery] = useState("");
  const entries = useMemo(() => codexEntries.filter((entry) => entry.type === tab && entry.name[locale].toLowerCase().includes(query.toLowerCase())), [tab, query, locale]);
  return <div className="shell page"><div className="page-intro"><p className="eyebrow">KNOWLEDGE BASE</p><h1>{t.codexTitle}</h1><p>{t.codexBody}</p></div><div className="codex-controls"><div className="tabs" role="tablist"><button className={tab === "commander" ? "active" : ""} onClick={() => setTab("commander")}>{t.commanders}</button><button className={tab === "equipment" ? "active" : ""} onClick={() => setTab("equipment")}>{t.equipment}</button></div><label className="search"><span aria-hidden>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchCodex} aria-label={t.searchCodex} /></label></div><div className="codex-grid">{entries.map((entry) => <Card className="codex-card" key={entry.name.vi}><div className="codex-avatar">{entry.initials}</div><div><Badge>{entry.season}</Badge><h2>{entry.name[locale]}</h2><dl><div><dt>{t.role}</dt><dd>{entry.role[locale]}</dd></div><div><dt>{t.updated}</dt><dd>{entry.updated}</dd></div></dl></div></Card>)}</div><p className="data-inline">ⓘ {t.dataNotice}</p></div>;
}
