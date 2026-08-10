"use client";

import { signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function GoogleSignInButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const searchParams = useSearchParams();

  async function handleSignIn() {
    setLoading(true);
    setFailed(false);
    try {
      await signIn("google", { redirectTo: "/" });
    } catch {
      setLoading(false);
      setFailed(true);
    }
  }

  return <><button className="google-button" type="button" onClick={handleSignIn} disabled={loading}><span className="google-g">G</span>{loading ? "Đang chuyển đến Google…" : label}</button>{failed || searchParams.has("error") ? <p className="signin-error" role="alert">Đăng nhập thất bại, thử lại.</p> : null}</>;
}

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  return <button className="account-action" type="button" disabled={loading} onClick={async () => { setLoading(true); await signOut({ redirectTo: "/" }); }}>{loading ? "Đang đăng xuất…" : "Đăng xuất"}</button>;
}
