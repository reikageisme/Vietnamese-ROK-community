"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function SecurityPanel({ initialMethods, emailVerified, reauthenticated }: { initialMethods: string[]; emailVerified: boolean; reauthenticated: boolean }) {
  const [methods, setMethods] = useState(initialMethods);
  const [message, setMessage] = useState("");
  async function beginGoogle(endpoint: "/api/auth/link-google" | "/api/auth/reauth-google") {
    setMessage("");
    const response = await fetch(endpoint, { method: "POST" });
    const body = await response.json() as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Không thể bắt đầu xác thực Google.");
    await signIn("google", { redirectTo: endpoint.includes("reauth") ? "/profile/security?reauth=1" : "/profile/security?linked=1" });
  }
  async function remove(method: "google" | "credentials") {
    const response = await fetch("/api/profile/security", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ method }) });
    const body = await response.json() as { error?: string; loginMethods?: string[] };
    if (!response.ok) return setMessage(body.error ?? "Không thể gỡ phương thức.");
    setMethods(body.loginMethods ?? []); setMessage("Đã cập nhật phương thức đăng nhập.");
  }
  async function setPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/auth/set-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: data.get("password"), currentPassword: data.get("currentPassword") || undefined }) });
    const body = await response.json() as { error?: string; loginMethods?: string[] };
    if (!response.ok) return setMessage(body.error ?? "Không thể đặt mật khẩu.");
    setMethods(body.loginMethods ?? methods); setMessage("Đã lưu mật khẩu mới và gửi email cảnh báo bảo mật."); form.reset();
  }
  const hasGoogle = methods.includes("google");
  const hasPassword = methods.includes("credentials");
  return <div className="security-stack">
    {!emailVerified ? <div className="security-warning">Email chưa xác thực. Bạn chưa thể tạo topic, trả lời hoặc báo cáo.</div> : null}
    {message ? <div className="security-message" role="status">{message}</div> : null}
    <section className="card security-method"><div><strong>Google</strong><p>{hasGoogle ? "Đã liên kết" : "Chưa liên kết"}</p></div>{hasGoogle ? <button onClick={() => remove("google")}>Gỡ</button> : <button className="button button-small" onClick={() => beginGoogle("/api/auth/link-google")}>Thêm Google</button>}</section>
    <section className="card security-method"><div><strong>Email và mật khẩu</strong><p>{hasPassword ? "Đã thiết lập" : "Chưa thiết lập"}</p></div>{hasPassword ? <button onClick={() => remove("credentials")}>Gỡ</button> : null}</section>
    <section className="card security-password"><h2>{hasPassword ? "Đổi mật khẩu" : "Thêm mật khẩu"}</h2>
      {!hasPassword && hasGoogle && !reauthenticated ? <button className="google-button" onClick={() => beginGoogle("/api/auth/reauth-google")}>Xác thực lại bằng Google</button> : null}
      <form className="auth-form" onSubmit={setPassword}>
        {hasPassword ? <label>Mật khẩu hiện tại<input name="currentPassword" type="password" required /></label> : null}
        <label>Mật khẩu mới<input name="password" type="password" minLength={10} required /><small>Tối thiểu 10 ký tự, có chữ và số.</small></label>
        <button className="button" disabled={!hasPassword && hasGoogle && !reauthenticated}>Lưu mật khẩu</button>
      </form>
    </section>
  </div>;
}

