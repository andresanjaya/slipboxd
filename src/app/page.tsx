import { Slipboxd } from "@/components/slipboxd";

// The release gate also affects the landing page at runtime, not just at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return <Slipboxd rssEnabled={process.env.RSS_ENABLED !== "false"}/>;
}
