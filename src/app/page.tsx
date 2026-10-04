import { SlipboxdApp } from "@/components/slipboxd-app";

// The release gate also affects the landing page at runtime, not just at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return <SlipboxdApp rssEnabled={process.env.RSS_ENABLED !== "false"} tmdbEnabled={Boolean(process.env.TMDB_API_READ_ACCESS_TOKEN)}/>;
}
