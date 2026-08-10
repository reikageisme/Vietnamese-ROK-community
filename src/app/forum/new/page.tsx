import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TopicEditor } from "@/components/forum/topic-editor";

export default async function NewTopicPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [session, query] = await Promise.all([auth(), searchParams]);
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/forum/new");
  if (!session.user.isEmailVerified) redirect("/profile/security");
  return <div className="shell page narrow-page"><div className="page-intro"><p className="eyebrow">FORUM</p><h1>Tạo chủ đề mới</h1><p>Chia sẻ kinh nghiệm bằng Markdown. Nội dung sẽ được sanitize trước khi lưu.</p></div><TopicEditor initialCategory={query.category} /></div>;
}
