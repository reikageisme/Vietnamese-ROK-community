import { auth } from "@/auth";
import { CategoryTopics } from "@/components/forum/category-topics";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const [{ category }, session] = await Promise.all([params, auth()]);
  return <CategoryTopics category={category} signedIn={Boolean(session?.user?.id)} verified={Boolean(session?.user?.isEmailVerified)} />;
}
