import Image from "next/image";

/** Khung biểu tượng theo độ hiếm.
 *
 * Ảnh gốc chỉ là chân dung nền trong suốt; nền màu, viền và bo góc do CSS sinh
 * ra. Nhờ vậy MỖI THỰC THỂ CHỈ CẦN MỘT ẢNH — đổi độ hiếm hay thêm mức hiếm mới
 * là chuyện của bảng màu, không phải chuyện xuất lại ảnh.
 *
 * Không có ảnh thì hiện chữ cái đầu trên đúng nền đó, nên lưới không bị thủng lỗ
 * trong lúc kho ảnh còn đang xây.
 */

export type Rarity = "NORMAL" | "ADVANCED" | "ELITE" | "EPIC" | "LEGENDARY";

const SIZES = { sm: 34, md: 48, lg: 72 } as const;

export function GameIcon({
  src,
  alt,
  rarity = "NORMAL",
  size = "md",
  badge,
}: {
  src?: string | null;
  alt: string;
  rarity?: Rarity;
  size?: keyof typeof SIZES;
  /** Góc dưới phải: bậc trang bị, cấp minh văn, số sao... */
  badge?: string | number;
}) {
  const px = SIZES[size];
  return (
    <span className={`game-icon game-icon-${size} rarity-bg-${rarity.toLowerCase()}`} aria-hidden={!alt}>
      {src ? (
        <Image src={src} alt={alt} width={px} height={px} unoptimized />
      ) : (
        <i className="game-icon-fallback">{alt.trim().slice(0, 1).toUpperCase()}</i>
      )}
      {badge != null ? <b className="game-icon-badge">{badge}</b> : null}
    </span>
  );
}
