"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/i18n/provider";
import { SignOutButton } from "@/components/auth-buttons";
import Image from "next/image";
import { NotificationBell } from "@/components/notification-bell";

type HeaderUser = { name?: string | null; image?: string | null };

export function SiteHeader({ user }: { user?: HeaderUser }) {
  const { locale, setLocale, t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    ["/", t.navHome],
    ["/forum", t.navForum],
    ["/kingdoms", locale === "vi" ? "Vương quốc" : "Kingdoms"],
    ["/kvk", "KvK"],
    ["/scans", locale === "vi" ? "Dịch vụ quét" : "Scan service"],
    ["/tools", t.navTools],
  ];
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="RokViet Hub">
          <span className="brand-mark"><i>R</i><b>V</b></span>
          <span><strong>RokViet <em>Hub</em></strong><small>{t.brandTagline}</small></span>
        </Link>
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t.menu}>☰</button>
        <nav className={open ? "nav open" : "nav"} aria-label="Primary navigation">
          {links.map(([href, label]) => <Link key={href} className={href === "/" ? pathname === "/" ? "active" : "" : pathname.startsWith(href) ? "active" : ""} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <div className="language" aria-label={t.language}>
            <button className={locale === "vi" ? "selected" : ""} onClick={() => setLocale("vi")}>VI</button>
            <span>/</span>
            <button className={locale === "en" ? "selected" : ""} onClick={() => setLocale("en")}>EN</button>
          </div>
          {user ? <><NotificationBell /><details className="account-menu"><summary>{user.image ? <Image src={user.image} alt="" width={34} height={34} unoptimized referrerPolicy="no-referrer" /> : <span className="account-avatar">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</span>}<span>{user.name ?? "Thành viên"}</span></summary><div className="account-dropdown"><Link href="/profile/security" onClick={() => setOpen(false)}>Bảo mật</Link><SignOutButton /></div></details></> : <Link className="button button-small" href="/auth/signin" onClick={() => setOpen(false)}>{t.signIn}</Link>}
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
          <div className="brand footer-brand"><span className="brand-mark"><i>R</i><b>V</b></span><span><strong>RokViet <em>Hub</em></strong><small>{t.brandTagline}</small></span></div>
          <p className="disclaimer">{t.disclaimer}</p>
          <p className="data-notice">{t.dataNotice}</p>
        </div>
        <div className="footer-links">
          <strong>{t.footerExplore}</strong>
          <Link href="/forum">{t.navForum}</Link><Link href="/kingdoms">Vương quốc</Link><Link href="/kvk">KvK</Link><Link href="/scans">Dịch vụ quét</Link><Link href="/tools">{t.navTools}</Link>
        </div>
        <div className="footer-links">
          <strong>{t.footerAbout}</strong>
          <a href="#">{t.footerGuidelines}</a><a href="#">{t.privacy}</a><a href="#">{t.footerContact}</a>
        </div>
      </div>
      <div className="shell copyright">© 2026 RokViet Hub · Made for the Vietnamese ROK community.</div>
    </footer>
  );
}
