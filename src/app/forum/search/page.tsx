import { SearchResults } from "@/components/forum/search-results";
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) { const query = await searchParams; return <SearchResults initialQuery={query.q ?? ""} />; }
