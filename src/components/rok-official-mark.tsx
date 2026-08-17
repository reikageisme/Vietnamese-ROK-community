import Image from "next/image";

const OFFICIAL_ROK_LOGO = "https://lilithimage.lilithcdn.com/allgames-official-web/rok/en/img/logo_pc1.png";

export function RokOfficialMark({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "official-mark compact" : "official-mark"}>
    <Image src={OFFICIAL_ROK_LOGO} alt="Rise of Kingdoms" width={compact ? 150 : 260} height={compact ? 52 : 90} unoptimized priority={!compact} />
    {!compact && <small>Game artwork © Lilith Games · RokViet Hub là dự án cộng đồng độc lập.</small>}
  </div>;
}
