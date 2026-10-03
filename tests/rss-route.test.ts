import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fetchPublicDiary, MAX_RSS_BYTES, validUsername } from "../src/lib/rss";
import { ImportError } from "../src/lib/model";
import { GET } from "../src/app/api/rss/route";

const xml = await readFile(new URL("./fixtures/public-rss.xml", import.meta.url), "utf8");
const mock = (response: () => Response | Promise<Response>) => (async () => response()) as typeof fetch;
const code = (expected: string) => (error: unknown) => error instanceof ImportError && error.code === expected;

test("username validation blocks arbitrary hosts, paths, credentials and query injection", async () => {
  assert.equal(validUsername(" Example_1 "), "example_1");
  for (const input of ["", "https://evil.test", "//evil.test", "../admin", "a?url=http://127.0.0.1", "a@evil.test", "a%2fb", "a\\b", "a".repeat(41)]) {
    let called = false;
    await assert.rejects(fetchPublicDiary(input, mock(() => { called = true; return new Response(xml); })), code("username"));
    assert.equal(called, false);
  }
});

test("fetch uses fixed HTTPS RSS URL, disallows redirects and sends no credentials", async () => {
  const result = await fetchPublicDiary(" Fictional_1 ", (async (url, init) => {
    assert.equal(url, "https://letterboxd.com/fictional_1/rss/");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.equal(new Headers(init?.headers).has("Cookie"), false);
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return new Response(xml);
  }) as typeof fetch);
  assert.equal(result.entries.length, 3);
  assert.equal(result.username, "fictional_1");
});

test("RSS upstream failure states and HTML challenges are handled", async () => {
  for (const [status, expected] of [[404, "rss-not-found"], [403, "rss-unavailable"], [500, "rss-upstream"], [429, "rss-upstream"]] as const) {
    await assert.rejects(fetchPublicDiary("fictional", mock(() => new Response("", { status }))), code(expected));
  }
  await assert.rejects(fetchPublicDiary("fictional", mock(() => new Response("<html><body>challenge</body></html>"))), code("rss-format"));
  await assert.rejects(fetchPublicDiary("fictional", mock(() => { throw new TypeError("redirect/network"); })), code("rss-network"));
});

test("RSS size cap applies to declared and streamed response bytes", async () => {
  await assert.rejects(fetchPublicDiary("fictional", mock(() => new Response("", { headers: { "content-length": String(MAX_RSS_BYTES + 1) } }))), code("rss-large"));
  await assert.rejects(fetchPublicDiary("fictional", mock(() => new Response(new Uint8Array(MAX_RSS_BYTES + 1)))), code("rss-large"));
});

test("timeout covers fetching and slow response bodies", async () => {
  await assert.rejects(fetchPublicDiary("fictional", (async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })) as typeof fetch, 15), code("rss-timeout"));
  await assert.rejects(fetchPublicDiary("fictional", (async (_url, init) => new Response(new ReadableStream({
    start(controller) { init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError"))); },
  }))) as typeof fetch, 15), code("rss-timeout"));
});

test("App Router handler validates, returns normalized RSS and caches briefly", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = mock(() => { calls++; return new Response(xml); });
  try {
    const invalid = await GET(new Request("http://localhost/api/rss?username=https://evil.test"));
    assert.equal(invalid.status, 400);
    assert.equal(calls, 0);
    const response = await GET(new Request("http://localhost/api/rss?username=route_fixture"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).entries.length, 3);
    await GET(new Request("http://localhost/api/rss?username=route_fixture"));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("RSS release switch disables the route", async () => {
  const original = process.env.RSS_ENABLED;
  process.env.RSS_ENABLED = "false";
  try { assert.equal((await GET(new Request("http://localhost/api/rss?username=fixture_disabled"))).status, 503); }
  finally { if (original === undefined) delete process.env.RSS_ENABLED; else process.env.RSS_ENABLED = original; }
});
