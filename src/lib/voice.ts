// Browser voice helpers: speech recognition + speech synthesis.

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

export type SpeechRecognitionErrorLike = {
  error?: string;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

export function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function detectLang(text: string): "ml" | "ar" | "en" {
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return "en";
}

export function bcp47ForText(text: string): "ml-IN" | "en-IN" | "ar-SA" {
  const l = detectLang(text);
  return l === "ml" ? "ml-IN" : l === "ar" ? "ar-SA" : "en-IN";
}

// ---------------------------------------------------------------------------
// Text cleaning before TTS
// ---------------------------------------------------------------------------

export function cleanForSpeech(text: string): string {
  return (
    text
      // code blocks / inline code
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      // urls & emails
      .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
      .replace(/\S+@\S+\.\S+/g, " ")
      // markdown emphasis / headings / links
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^[>#]+\s?/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/[*_~`#|]+/g, " ")
      // emojis & pictographs
      .replace(
        /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}]|\uFE0F|\u200D/gu,
        " ",
      )
      // leftover stray symbols (keep letters of all scripts + basic punctuation)
      .replace(/[<>{}[\]\\^=+/]/g, " ")
      // avoid unnatural pauses from spaces left before punctuation
      .replace(/\s+([,.!?;:])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// TTS Playback with ElevenLabs + Web Speech API Fallback
// ---------------------------------------------------------------------------

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let playToken = 0;

function disposeCurrent(): void {
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Unlock audio playback on mobile — call from a user gesture. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const a = new Audio(
      "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVEQU1FMy45OS41VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==",
    );
    a.volume = 0;
    void a.play().catch(() => {});
  } catch {
    /* noop */
  }
}

function speakViaWebSpeech(
  text: string,
  onEnd: () => void,
  onStart?: () => void,
  expectedToken?: number,
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const detected = detectLang(text);
    const targetLang = detected === "ml" ? "ml-IN" : detected === "ar" ? "ar-SA" : "en-IN";
    utterance.lang = targetLang;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang === targetLang) ||
      voices.find((v) => v.lang.startsWith(targetLang.slice(0, 2)));
    if (match) {
      utterance.voice = match;
    }

    let finished = false;
    const safeEnd = () => {
      if (finished) return;
      finished = true;
      if (expectedToken !== undefined && expectedToken !== playToken) return;
      onEnd();
    };

    utterance.onstart = () => {
      if (expectedToken !== undefined && expectedToken !== playToken) return;
      onStart?.();
    };

    utterance.onend = safeEnd;
    utterance.onerror = safeEnd;

    // Safari / Chrome safety: onstart might lag or fail silently
    setTimeout(() => {
      if (!finished && window.speechSynthesis.speaking) {
        onStart?.();
      }
    }, 200);

    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd();
  }
}

/**
 * Speak text with ElevenLabs server-side voice with automatic browser Web Speech API fallback.
 * onEnd always fires (also on failure) so the listen loop keeps working without freeze.
 * onStart fires when audio actually begins playing.
 */
export async function speak(text: string, onEnd: () => void, onStart?: () => void): Promise<void> {
  const clean = cleanForSpeech(text);
  if (!clean) {
    onEnd();
    return;
  }

  stopSpeaking();
  const token = ++playToken;

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    });

    if (!res.ok) {
      // Fallback seamlessly to Web Speech API
      speakViaWebSpeech(clean, onEnd, onStart, token);
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    // If the server directed us to client-side speech synthesis
    if (contentType.includes("application/json")) {
      speakViaWebSpeech(clean, onEnd, onStart, token);
      return;
    }

    const blob = await res.blob();
    if (token !== playToken) return;

    if (!blob || blob.size === 0) {
      speakViaWebSpeech(clean, onEnd, onStart, token);
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentUrl = url;

    const finish = () => {
      if (token !== playToken) return;
      disposeCurrent();
      onEnd();
    };

    audio.onended = finish;
    audio.onerror = () => {
      // If audio element failed to decode, fallback to Web Speech
      disposeCurrent();
      speakViaWebSpeech(clean, onEnd, onStart, token);
    };

    onStart?.();
    await audio.play();
  } catch {
    if (token !== playToken) return;
    speakViaWebSpeech(clean, onEnd, onStart, token);
  }
}

export function stopSpeaking(): void {
  playToken += 1;
  disposeCurrent();
}
