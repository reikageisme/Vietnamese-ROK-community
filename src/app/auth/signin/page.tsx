"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { useLocale } from "@/i18n/provider";
import { GoogleSignInButton } from "@/components/auth-buttons";
import { Suspense } from "react";
import { CredentialsSignInForm } from "@/components/auth-forms";

export default function SignInPage() {
  const { t } = useLocale();
  return <div className="signin-page"><Card className="signin-card"><div className="signin-mark">RV</div><p className="eyebrow">ROKVIET HUB</p><h1>{t.signinTitle}</h1><p>{t.signinBody}</p><Suspense fallback={<button className="google-button" disabled>{t.continueGoogle}</button>}><GoogleSignInButton label={t.continueGoogle} /></Suspense><div className="auth-divider"><span>hoặc</span></div><Suspense><CredentialsSignInForm /></Suspense><div className="signin-notice"><span>i</span><p>{t.signinNotice}</p></div><small>{t.termsPrefix} <Link href="#">{t.terms}</Link> & <Link href="#">{t.privacy}</Link>.</small></Card></div>;
}
