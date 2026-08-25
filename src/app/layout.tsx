import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/i18n/provider";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { auth } from "@/auth";
import { CookieConsent } from "@/components/cookie-consent";
import { VerificationBanner } from "@/components/verification-banner";

export const metadata: Metadata = {
  title: { default: "ROK FAQ", template: "%s · ROK FAQ" },
  description: "Nền tảng kiến thức, công cụ và cộng đồng độc lập dành cho người chơi Rise of Kingdoms Việt Nam.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="vi">
      <body>
        <LocaleProvider>
          <SiteHeader user={session?.user} />
          {session?.user && !session.user.isEmailVerified ? <VerificationBanner /> : null}
          <main>{children}</main>
          <SiteFooter />
          {/* Phải nằm TRONG LocaleProvider: băng cookie dùng useLocale(). */}
          <CookieConsent />
        </LocaleProvider>
      </body>
    </html>
  );
}
