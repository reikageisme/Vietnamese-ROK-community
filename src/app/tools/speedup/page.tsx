"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { useLocale } from "@/i18n/provider";

const safe = (value: string) => Math.max(0, Number.parseInt(value || "0", 10) || 0);

export default function SpeedupPage() {
  const { t } = useLocale();
  const [values, setValues] = useState({ days: "0", hours: "0", minutes: "0", one: "0", five: "0", sixty: "0" });
  const [copied, setCopied] = useState(false);
  const total = useMemo(() => safe(values.days) * 1440 + safe(values.hours) * 60 + safe(values.minutes) + safe(values.one) + safe(values.five) * 5 + safe(values.sixty) * 60, [values]);
  const result = `${Math.floor(total / 1440)} ${t.days.toLowerCase()} · ${Math.floor((total % 1440) / 60)} ${t.hours.toLowerCase()} · ${total % 60} ${t.minutes.toLowerCase()}`;
  const field = (key: keyof typeof values, label: string) => <label className="field"><span>{label}</span><input type="number" min="0" inputMode="numeric" value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} /><small>{key === "days" ? t.days : key === "hours" || key === "sixty" ? t.hours : t.minutes}</small></label>;
  async function copy() { await navigator.clipboard.writeText(result); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <div className="shell page narrow-page"><div className="page-intro"><p className="eyebrow">FREE TOOL · SPEEDUP</p><h1>{t.speedupTitle}</h1><p>{t.speedupBody}</p></div><div className="calculator-layout"><Card className="calculator-form"><h2>Thời gian trực tiếp</h2><div className="field-grid">{field("days", t.days)}{field("hours", t.hours)}{field("minutes", t.minutes)}</div><div className="form-divider" /><h2>Vật phẩm tăng tốc</h2><div className="field-grid">{field("one", t.oneMinuteItems)}{field("five", t.fiveMinuteItems)}{field("sixty", t.sixtyMinuteItems)}</div></Card><Card className="result-card"><span>{t.result}</span><strong>{result}</strong><button className="button" onClick={copy}>{copied ? t.copied : t.copyResult}</button><button className="button secondary" onClick={() => setValues({ days: "0", hours: "0", minutes: "0", one: "0", five: "0", sixty: "0" })}>{t.reset}</button><small>✓ {t.freeNote}</small></Card></div></div>;
}
