import Link from "next/link";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function SectionHeading({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {href && action ? <Link href={href}>{action} <span aria-hidden>→</span></Link> : null}
    </div>
  );
}
