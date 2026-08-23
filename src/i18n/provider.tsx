"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import vi from "./vi.json";
import en from "./en.json";

export type Locale = "vi" | "en";
type Dictionary = typeof vi;

const dictionaries: Record<Locale, Dictionary> = { vi, en };
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}>({ locale: "vi", setLocale: () => undefined, t: vi });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("vi");

  useEffect(() => {
    const saved = window.localStorage.getItem("rokfaq-locale");
    if (saved !== "vi" && saved !== "en") return;
    const frame = window.requestAnimationFrame(() => setLocale(saved));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("rokfaq-locale", locale);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t: dictionaries[locale] }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
