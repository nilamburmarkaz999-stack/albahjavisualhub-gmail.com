import { createFileRoute } from "@tanstack/react-router";

// Liam — natural, friendly young male voice (English / Arabic default).
const VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ";

// Optional override: a Malayalam-capable MALE voice from the connected account.
function malayalamVoiceId(): string {
  const id = process.env["MALAYALAM_VOICE_ID"];
  return id && id.trim() ? id.trim() : VOICE_ID;
}

const MALAYALAM_RE = /[\u0D00-\u0D7F]/;
const ARABIC_RE = /[\u0600-\u06FF]/;

function detectLang(text: string): "ml" | "ar" | "en" {
  if (MALAYALAM_RE.test(text)) return "ml";
  if (ARABIC_RE.test(text)) return "ar";
  return "en";
}

/**
 * Pronunciation mapping for Malayalam speech only.
 * Latin-script names inside Malayalam sentences get their Malayalam spelling so
 * the multilingual model pronounces them naturally.
 */
const ML_PRONUNCIATION: Array<[RegExp, string]> = [
  [/\bThanafus\b/gi, "തനാഫുസ്"],
  [/\bTanafus\b/gi, "തനാഫുസ്"],
  [/\bNilambur\b/gi, "നിലമ്പൂർ"],
  [/\bChandakkunnu\b/gi, "ചന്ദക്കുന്ന്"],
  [/\bMarkaz\b/gi, "മർകസ്"],
  [/\bArts?\s*Fest\b/gi, "ആർട്സ് ഫെസ്റ്റ്"],
  [/\bAI\b/g, "എ ഐ"],
  [/\bRobot\b/gi, "റോബോട്ട്"],
  [/\bChairman\b/gi, "ചെയർമാൻ"],
  [/\bProgramme?s?\b/gi, "പ്രോഗ്രാം"],
];

function applyMalayalamPronunciation(text: string): string {
  let out = text;
  for (const [re, rep] of ML_PRONUNCIATION) out = out.replace(re, rep);
  return out
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([.!?])\1+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const ML_MODEL = "eleven_v3";
const DEFAULT_MODEL = "eleven_multilingual_v2";

function settingsFor(lang: "ml" | "ar" | "en"): Record<string, unknown> {
  if (lang === "ml") {
    return {
      stability: 0.5,
      similarity_boost: 0.85,
      use_speaker_boost: true,
    };
  }
  return {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.35,
    use_speaker_boost: true,
    speed: 1.0,
  };
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { text?: string };
        const raw = (body.text ?? "").trim().slice(0, 4800);
        if (!raw) {
          return new Response(JSON.stringify({ error: "text required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const rawKey = process.env["ELEVENLABS_API_KEY"]?.trim();
        // Valid ElevenLabs secret API keys strictly start with "sk_".
        // If an API key ID (e.g. UUID/hex) is provided, calling ElevenLabs will error out with 400.
        const isElevenLabsKeyValid = Boolean(rawKey && rawKey.startsWith("sk_"));

        if (isElevenLabsKeyValid && rawKey) {
          try {
            const lang = detectLang(raw);
            const text = lang === "ml" ? applyMalayalamPronunciation(raw) : raw;
            const voiceId = lang === "ml" ? malayalamVoiceId() : VOICE_ID;

            const res = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
              {
                method: "POST",
                headers: {
                  "xi-api-key": rawKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  text,
                  model_id: lang === "ml" ? ML_MODEL : DEFAULT_MODEL,
                  voice_settings: settingsFor(lang),
                }),
              },
            );

            if (res.ok) {
              const audio = await res.arrayBuffer();
              return new Response(audio, {
                headers: {
                  "Content-Type": "audio/mpeg",
                  "Cache-Control": "no-store",
                },
              });
            }
          } catch {
            // Silently fall through to web speech fallback
          }
        }

        // Return a clean 200 response instructing the client to use browser speech synthesis
        return new Response(
          JSON.stringify({
            useWebSpeech: true,
            message: "Using browser speech synthesis",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
