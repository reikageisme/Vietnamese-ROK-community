import { auth } from "@/auth";
import { TopicThread } from "@/components/forum/topic-thread";

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  return <TopicThread topicKey={id} currentUser={session?.user?.id ? { id: session.user.id, verified: session.user.isEmailVerified, role: session.user.role } : null} />;
}
