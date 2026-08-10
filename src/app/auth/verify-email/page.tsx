import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { VerifyEmailAction } from "@/components/auth-forms";
export default function VerifyEmailPage() { return <div className="signin-page"><Card className="signin-card"><h1>Xác thực email</h1><Suspense><VerifyEmailAction /></Suspense><Link className="button" href="/forum">Đến diễn đàn</Link></Card></div>; }
