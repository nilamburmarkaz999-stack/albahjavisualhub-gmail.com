// Malayalam pronunciation test set for the /api/tts route.
// Usage: bun scripts/malayalam-tts-test.mjs [baseUrl]
// Writes MP3s to /tmp/ml-tts/. Each phrase costs ElevenLabs credits — run only
// when credits are available.

const base = process.argv[2] ?? "http://localhost:8080";

const PHRASES = [
  "ഹലോ കൂട്ടുകാരേ!",
  "ഞാൻ Tanafus AI Robot ആണ്.",
  "നിങ്ങളെ സഹായിക്കാൻ ഞാൻ റെഡിയാണ്.",
  "തനാഫുസ് ആർട്ട് ഫെസ്റ്റ് 2026",
  "നിലമ്പൂർ മാർക്കസ്",
  "ചന്ദക്കുന്ന്",
];

const { mkdir, writeFile } = await import("node:fs/promises");
await mkdir("/tmp/ml-tts", { recursive: true });

let i = 0;
for (const text of PHRASES) {
  i += 1;
  const res = await fetch(`${base}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.log(`${i}. FAIL ${res.status} — ${await res.text()}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `/tmp/ml-tts/ml-${i}.mp3`;
  await writeFile(file, buf);
  console.log(`${i}. OK ${buf.length} bytes -> ${file} — ${text}`);
}
