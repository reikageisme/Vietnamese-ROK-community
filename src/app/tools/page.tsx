"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { tools } from "@/data/mock-data";
import { useLocale } from "@/i18n/provider";

export default function ToolsPage() {
  const { locale, t } = useLocale();
  return <div className="shell page"><div className="page-intro"><p className="eyebrow">CALCULATORS</p><h1>{t.toolsTitle}</h1><p>{t.toolsBody}</p></div><div className="tools-grid">{tools.map((tool, index) => <Card className={`tool-card ${!tool.available ? "muted" : ""}`} key={tool.slug}><div className="tool-top"><span className="tool-number">0{index + 1}</span>{!tool.available && <Badge>MVP SOON</Badge>}</div><span className="tool-big-mark">{tool.mark}</span><h2>{tool.name[locale]}</h2><p>{tool.description[locale]}</p>{tool.available ? <Link className="text-link" href={`/tools/${tool.slug}`}>{t.useTool} →</Link> : <span className="text-link disabled">{t.useTool} →</span>}</Card>)}</div></div>;
}
