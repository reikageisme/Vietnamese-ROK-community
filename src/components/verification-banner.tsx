"use client";

import { useLocale } from "@/i18n/provider";

/** Trước đây câu này viết cứng tiếng Việt trong layout, nên bản tiếng Anh vẫn
 *  hiện tiếng Việt. */
export function VerificationBanner() {
  const { t } = useLocale();
  return <div className="verification-banner">{t.verifyEmailBanner}</div>;
}
