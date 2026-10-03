import { fetchPublicDiary, validUsername } from "@/lib/rss";
import { ImportError, type ImportResult } from "@/lib/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cache = new Map<string, { expires: number; result: ImportResult }>();

export async function GET(request: Request) {
  const username = validUsername(new URL(request.url).searchParams.get("username") ?? "");
  if (!username) return Response.json({ error: "Masukkan username Letterboxd yang valid, bukan URL.", code: "username" }, { status: 400 });
  if (process.env.RSS_ENABLED === "false") return Response.json({ error: "Mode username sedang tidak tersedia. Gunakan upload ekspor.", code: "rss-disabled" }, { status: 503 });
  try {
    const cached = cache.get(username);
    if (cached && cached.expires > Date.now()) return Response.json(cached.result, { headers: { "Cache-Control": `public, max-age=${Math.max(0, Math.floor((cached.expires - Date.now()) / 1000))}` } });
    const result = await fetchPublicDiary(username);
    // Only normalized public entries are cached, never the source XML or reviews.
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(username, { expires: Date.now() + 60_000, result });
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    const known = error instanceof ImportError;
    return Response.json({ error: known ? error.message : "Aktivitas publik belum bisa dimuat. Coba lagi atau upload ekspor.", code: known ? error.code : "rss-error" },
      { status: known ? error.status : 502, headers: { "Cache-Control": "no-store" } });
  }
}
