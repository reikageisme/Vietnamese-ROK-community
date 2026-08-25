"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { useLocale } from "@/i18n/provider";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { Suspense } from "react";
import { CredentialsSignInForm } from "@/components/auth-forms";

export default function SignInPage() {
  const { t } = useLocale();
  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";
  return <div className="signin-page"><Card className="signin-card"><div className="signin-mark">RF</div><p className="eyebrow">ROK FAQ</p><h1>{t.signinTitle}</h1><p>{t.signinBody}</p>{showDemo ? <div className="demo-account-box"><strong>Tài khoản thử nghiệm</strong><code>demo.member@rokfaq.local / RokFaqDemo!2026</code><code>demo.mod@rokfaq.local / RokFaqMod!2026</code><small>Chỉ bật trên môi trường test, không dùng khi public.</small></div> : null}<Suspense fallback={<button className="google-button" disabled>{t.continueGoogle}</button>}><GoogleSignInButton label={t.continueGoogle} /></Suspense><div className="auth-divider"><span>hoặc</span></div><Suspense><CredentialsSignInForm /></Suspense><div className="signin-notice"><span>i</span><p>{t.signinNotice}</p></div><small>{t.termsPrefix} <Link href="/community-guidelines">{t.terms}</Link> & <Link href="/privacy">{t.privacy}</Link>.</small></Card></div>;
}
