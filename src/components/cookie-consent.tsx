"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/provider";

const STORAGE_KEY = "rokfaq.cookie-consent";

/** Băng chấp nhận cookie.
 *
 * Nói đúng sự thật thay vì đe doạ: cookie phiên đăng nhập là THIẾT YẾU và
 * không tắt được — không có nó thì không đăng nhập được, nên hỏi cũng vô nghĩa.
 * Cookie phân tích là tuỳ chọn và MẶC ĐỊNH TẮT; chỉ bật khi người dùng đồng ý.
 *
 * Lựa chọn lưu trong localStorage, không phải cookie — thứ mỉa mai mà nhiều
 * trang làm sai: đặt một cookie để nhớ rằng bạn từ chối cookie.
 */
export function CookieConsent() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Trình duyệt chặn lưu trữ (cửa sổ riêng tư, chặn site data). Không hiện
      // băng còn hơn hiện một băng bấm mãi không tắt được.
    }
  }, []);

  function decide(choice: "all" | "essential") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
    } catch {
      /* không lưu được thì thôi, vẫn đóng băng cho người dùng đi tiếp */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-bar" role="dialog" aria-live="polite" aria-label={t.cookieTitle}>
      <div className="cookie-copy">
        <strong>{t.cookieTitle}</strong>
        <p>{t.cookieBody} <Link href="/privacy">{t.cookieMore}</Link></p>
      </div>
      <div className="cookie-actions">
        <button className="button button-secondary button-small" onClick={() => decide("essential")}>{t.cookieDecline}</button>
        <button className="button button-small" onClick={() => decide("all")}>{t.cookieAccept}</button>
      </div>
    </div>
  );
}

/** Cho phần còn lại của trang hỏi: người dùng đã đồng ý cookie phân tích chưa.
 *  Chưa có công cụ phân tích nào được gắn, nhưng khi gắn thì phải đi qua đây. */
export function hasAnalyticsConsent(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).choice === "all" : false;
  } catch {
    return false;
  }
}
