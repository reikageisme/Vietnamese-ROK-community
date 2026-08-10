import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";

export default async function UserActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, reputation, topics, replies] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { id: true, displayName: true, name: true, createdAt: true } }),
    prisma.reputationEvent.aggregate({ where: { userId: id }, _sum: { points: true } }),
    prisma.topic.findMany({ where: { authorId: id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, slug: true, title: true, createdAt: true, replyCount: true } }),
    prisma.reply.findMany({ where: { authorId: id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, body: true, createdAt: true, topic: { select: { slug: true, title: true } } } }),
  ]);
  if (!user) notFound();
  return <div className="shell page narrow-page"><div className="page-intro"><p className="eyebrow">THÀNH VIÊN</p><h1>{user.displayName ?? user.name ?? "Thành viên"}</h1><p><span className="reputation-badge">{reputation._sum.points ?? 0} reputation</span> · tham gia {user.createdAt.toLocaleDateString("vi-VN")}</p></div><div className="activity-columns"><section><h2>Chủ đề</h2>{topics.map((topic) => <Link key={topic.id} href={`/forum/topic/${topic.slug}`}><Card className="activity-card"><strong>{topic.title}</strong><small>{topic.replyCount} trả lời · {topic.createdAt.toLocaleDateString("vi-VN")}</small></Card></Link>)}</section><section><h2>Câu trả lời</h2>{replies.map((reply) => <Link key={reply.id} href={`/forum/topic/${reply.topic.slug}`}><Card className="activity-card"><strong>{reply.topic.title}</strong><p>{reply.body.slice(0, 140)}</p></Card></Link>)}</section></div></div>;
}
