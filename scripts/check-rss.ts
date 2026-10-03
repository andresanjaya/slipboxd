import { fetchPublicDiary } from "../src/lib/rss";
import { observedRange } from "../src/lib/model";

// Explicit smoke check; never part of deterministic tests. No XML or titles logged/saved.
try {
  const result = await fetchPublicDiary(process.argv[2] ?? "");
  console.log(JSON.stringify({ ok: true, entries: result.entries.length, skipped: result.skipped, duplicates: result.duplicates, range: observedRange(result.entries) }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "RSS check failed");
  process.exitCode = 1;
}
