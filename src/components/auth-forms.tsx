"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type ApiResult = { error?: string; message?: string };

export function CredentialsSignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: data.get("email"), password: data.get("password"), redirect: false,
    });
    setLoading(false);
    if (result?.error) return setError("Email hoặc mật khẩu không đúng, hoặc tài khoản đang tạm khóa.");
    router.push(params.get("callbackUrl") || "/");
    router.refresh();
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required /></label>
    {error ? <p className="auth-error" role="alert">{error}</p> : null}
    <button className="button" disabled={loading}>{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    <div className="auth-links"><Link href="/auth/forgot-password">Quên mật khẩu?</Link><Link href="/auth/register">Tạo tài khoản</Link></div>
  </form>;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmPassword")) return setError("Hai mật khẩu chưa khớp.");
    setLoading(true);
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      displayName: data.get("displayName"), email: data.get("email"), password: data.get("password"), acceptedTerms: data.get("terms") === "on",
    }) });
    const body = await response.json() as ApiResult;
    setLoading(false);
    if (!response.ok) return setError(body.error ?? "Không thể đăng ký.");
    router.push("/auth/signin?registered=1");
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>Tên hiển thị<input name="displayName" minLength={2} maxLength={100} required /></label>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Mật khẩu<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /><small>Tối thiểu 10 ký tự, có ít nhất một chữ cái và một chữ số.</small></label>
    <label>Xác nhận mật khẩu<input name="confirmPassword" type="password" minLength={10} autoComplete="new-password" required /></label>
    <label className="auth-check"><input name="terms" type="checkbox" required /> Tôi đồng ý với điều khoản sử dụng và chính sách riêng tư.</label>
    {error ? <p className="auth-error" role="alert">{error}</p> : null}
    <button className="button" disabled={loading}>{loading ? "Đang tạo tài khoản…" : "Đăng ký"}</button>
    <p className="auth-switch">Đã có tài khoản? <Link href="/auth/signin">Đăng nhập</Link></p>
  </form>;
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.get("email") }) });
    const body = await response.json() as ApiResult;
    setMessage(body.message ?? body.error ?? "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.");
  }
  return <form className="auth-form" onSubmit={submit}><label>Email<input name="email" type="email" required /></label>{message ? <p className="auth-success">{message}</p> : null}<button className="button">Gửi hướng dẫn</button></form>;
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: params.get("token"), password: data.get("password") }) });
    const body = await response.json() as ApiResult;
    setMessage(response.ok ? "Mật khẩu đã được đổi. Hãy đăng nhập lại trên các thiết bị." : body.error ?? "Không thể đổi mật khẩu.");
  }
  return <form className="auth-form" onSubmit={submit}><label>Mật khẩu mới<input name="password" type="password" minLength={10} required /><small>Tối thiểu 10 ký tự, có chữ và số.</small></label>{message ? <p className="auth-success">{message}</p> : null}<button className="button">Đặt mật khẩu mới</button></form>;
}

export function VerifyEmailAction() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Đang xác thực…");
  const token = params.get("token");
  useEffect(() => {
    fetch("/api/auth/verify-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => ({ ok: response.ok, body: await response.json() as ApiResult }))
      .then(({ ok, body }) => setMessage(ok ? "Email đã được xác thực. Bạn có thể đăng bài ngay." : body.error ?? "Không thể xác thực email."));
  }, [token]);
  return <p className="auth-success">{message}</p>;
}
