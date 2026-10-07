import { ChartsView } from "@/components/charts-view";

export const dynamic = "force-dynamic";

export default function ChartsPage() {
  return <ChartsView tmdbEnabled={Boolean(process.env.TMDB_API_READ_ACCESS_TOKEN)}/>;
}
