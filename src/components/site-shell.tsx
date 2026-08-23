"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/i18n/provider";
import { SignOutButton } from "@/components/auth-buttons";
import Image from "next/image";
import { NotificationBell } from "@/components/notification-bell";

type HeaderUser = { id?: string; name?: string | null; image?: string | null; role?: string };

export function SiteHeader({ user }: { user?: HeaderUser }) {
  const { locale, setLocale, t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    ["/", t.navHome],
    ["/forum", t.navForum],
    ["/kingdoms", locale === "vi" ? "Vương quốc" : "Kingdoms"],
    ["/kvk", "KvK"],
    ["/tools", t.navTools],
  ];
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="ROK FAQ">
          <span className="brand-mark"><i>R</i><b>F</b></span>
          <span><strong>ROK <em>FAQ</em></strong><small>{t.brandTagline}</small></span>
        </Link>
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t.menu}>☰</button>
        <nav className={open ? "nav open" : "nav"} aria-label="Primary navigation">
          {links.map(([href, label]) => <Link key={href} className={href === "/" ? pathname === "/" ? "active" : "" : pathname.startsWith(href) ? "active" : ""} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <div className="language" aria-label={t.language}>
            <button className={locale === "vi" ? "selected" : ""} onClick={() => setLocale("vi")}>VI</button>
            <span>/</span>
            <button className={locale === "en" ? "selected" : ""} onClick={() => setLocale("en")}>EN</button>
          </div>
          {user ? <><NotificationBell /><details className="account-menu"><summary>{user.image ? <Image src={user.image} alt="" width={34} height={34} unoptimized referrerPolicy="no-referrer" /> : <span className="account-avatar">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</span>}<span>{user.name ?? "Thành viên"}</span></summary><div className="account-dropdown"><Link href="/profile" onClick={() => setOpen(false)}>Trang cá nhân</Link>{user.id ? <Link href={`/profile/${user.id}/activity`} onClick={() => setOpen(false)}>Hoạt động</Link> : null}<Link href="/profile/security" onClick={() => setOpen(false)}>Bảo mật</Link>{user.role && ["MODERATOR", "ADMIN"].includes(user.role) ? <Link href="/moderation/reports" onClick={() => setOpen(false)}>Kiểm duyệt</Link> : null}{user.role === "ADMIN" ? <Link href="/moderation/audit-log" onClick={() => setOpen(false)}>Nhật ký quản trị</Link> : null}<SignOutButton /></div></details></> : <Link className="button button-small" href="/auth/signin" onClick={() => setOpen(false)}>{t.signIn}</Link>}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <div className="brand footer-brand"><span className="brand-mark"><i>R</i><b>F</b></span><span><strong>ROK <em>FAQ</em></strong><small>{t.brandTagline}</small></span></div>
          <p className="disclaimer">{t.disclaimer}</p>
          <p className="data-notice">{t.dataNotice}</p>
        </div>
        <div className="footer-links">
          <strong>{t.footerExplore}</strong>
          <Link href="/forum">{t.navForum}</Link><Link href="/kingdoms">Vương quốc</Link><Link href="/kvk">KvK</Link><Link href="/tools">{t.navTools}</Link>
        </div>
        <div className="footer-links">
          <strong>{t.footerAbout}</strong>
          <Link href="/community-guidelines">{t.footerGuidelines}</Link><Link href="/privacy">{t.privacy}</Link><Link href="/contact">{t.footerContact}</Link>
        </div>
      </div>
      <div className="shell copyright">© 2026 ROK FAQ · Made for the Vietnamese ROK community.</div>
    </footer>
  );
}
