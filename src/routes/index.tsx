import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, RotateCcw, Send, Sparkles, Volume2 } from "lucide-react";
import { Robot, type RobotState } from "@/components/Robot";
import {
  getRecognition,
  speak,
  stopSpeaking,
  unlockAudio,
  type SpeechRecognitionLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionErrorLike,
} from "@/lib/voice";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Thanafus AI — Voice Assistant for Thanafus Art Fest 2026" },
      {
        name: "description",
        content:
          "Conversational voice AI assistant for Thanafus Art Fest 2026, powered by Google Gemini. Ask about programs, schedules, officials, or general educational questions in Malayalam, English, and Arabic.",
      },
      { property: "og:title", content: "Thanafus AI — Voice Assistant" },
      {
        property: "og:description",
        content:
          "Official conversational AI assistant for Thanafus Art Fest 2026 powered by Google Gemini.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Turn = { role: "user" | "assistant"; content: string; id: string };

const LANGS = [
  { code: "ml-IN", label: "മലയാളം" },
  { code: "en-IN", label: "English" },
  { code: "ar-SA", label: "العربية" },
];

const STATUS: Record<RobotState, string> = {
  idle: "● Ready to Listen",
  listening: "👂 Listening...",
  thinking: "🤔 Thinking with Gemini...",
  speaking: "🔊 Speaking...",
};

const SUGGESTIONS = [
  "Thanafus 2026 എപ്പോഴാണ്?",
  "Who is the Fest Chairman?",
  "വേദി എവിടെയാണ്?",
  "Website നിർമ്മിച്ചത് ആരാണ്?",
  "Tell me a short science fact",
];

function Index() {
  const [state, setState] = useState<RobotState>("idle");
  const [active, setActive] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [supported, setSupported] = useState(true);
  const [lang, setLang] = useState("ml-IN");
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [textInput, setTextInput] = useState("");

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const stateRef = useRef<RobotState>("idle");
  const turnsRef = useRef<Turn[]>([]);
  const langRef = useRef(lang);
  const logRef = useRef<HTMLDivElement>(null);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  stateRef.current = state;
  turnsRef.current = turns;
  langRef.current = lang;
  activeRef.current = active;

  useEffect(() => {
    setSupported(!!getRecognition());
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [turns, interim]);

  const startListening = useCallback(() => {
    if (!activeRef.current || stateRef.current === "speaking" || stateRef.current === "thinking") {
      return;
    }
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.lang = langRef.current;
      rec.start();
    } catch {
      /* already active */
    }
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = null;
      }

      setInterim("");
      setError(null);

      const userTurn: Turn = {
        role: "user",
        content: clean,
        id: `${Date.now()}-u`,
      };
      const nextTurns = [...turnsRef.current, userTurn];
      setTurns(nextTurns);
      setState("thinking");

      // Watchdog timeout: prevent staying permanently stuck in 'thinking'
      thinkingTimeoutRef.current = setTimeout(() => {
        if (stateRef.current === "thinking") {
          setError("Request timed out. Please try asking again.");
          if (activeRef.current) {
            setState("listening");
            setTimeout(startListening, 300);
          } else {
            setState("idle");
          }
        }
      }, 25000);

      try {
        const payloadMessages = nextTurns.map((t) => ({
          role: t.role,
          content: t.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payloadMessages }),
        });

        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            res.status === 429
              ? "Rate limit reached. Please wait a moment."
              : body.error || `Gemini request failed (${res.status})`,
          );
        }

        const data = (await res.json()) as { reply?: string };
        const reply =
          data.reply?.trim() ||
          "ക്ഷമിക്കണം, ഈ വിവരത്തിന്റെ ഔദ്യോഗിക വിശദാംശം ഇപ്പോൾ എന്റെ Database-ൽ ലഭ്യമല്ല.";

        const assistantTurn: Turn = {
          role: "assistant",
          content: reply,
          id: `${Date.now()}-a`,
        };
        setTurns((prev) => [...prev, assistantTurn]);
        setAudioLoading(true);

        // Required voice loop: SPEAKING -> automatically back to LISTENING
        void speak(
          reply,
          () => {
            // onEnd callback: fires when playback finishes OR on TTS fallback completion
            setAudioLoading(false);
            if (activeRef.current) {
              setState("listening");
              setTimeout(startListening, 300);
            } else {
              setState("idle");
            }
          },
          () => {
            // onStart callback: fires when audio begins playing through speakers
            setAudioLoading(false);
            setState("speaking");
          },
        );
      } catch (err: unknown) {
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }
        setError(err instanceof Error ? err.message : "Something went wrong.");
        if (activeRef.current) {
          setState("listening");
          setTimeout(startListening, 400);
        } else {
          setState("idle");
        }
      }
    },
    [startListening],
  );

  const buildRecognition = useCallback(() => {
    const rec = getRecognition();
    if (!rec) return null;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = langRef.current;

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let finalText = "";
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r && r.isFinal) finalText += r[0]?.transcript ?? "";
        else if (r) partial += r[0]?.transcript ?? "";
      }
      setInterim(partial);
      if (finalText.trim()) {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
        void ask(finalText);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorLike) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setActive(false);
        activeRef.current = false;
        setState("idle");
        setError("Microphone permission was denied. Please allow it in your browser settings.");
      } else if (
        e?.error === "no-speech" ||
        e?.error === "audio-capture" ||
        e?.error === "network"
      ) {
        // Recoverable speech recognition events: keep loop resilient
        if (activeRef.current && stateRef.current === "listening") {
          setTimeout(() => startListening(), 400);
        }
      }
    };

    rec.onend = () => {
      // Automatic resumption: restart listener if active and currently in listening state
      if (activeRef.current && stateRef.current === "listening") {
        setTimeout(() => startListening(), 250);
      }
    };

    return rec;
  }, [ask, startListening]);

  const enableVoice = useCallback(async () => {
    setError(null);
    setPermissionAsked(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError("Microphone permission is required for voice conversation.");
      return;
    }

    if (!recRef.current) {
      recRef.current = buildRecognition();
    }
    if (!recRef.current) {
      setSupported(false);
      return;
    }

    setActive(true);
    activeRef.current = true;
    setState("listening");
    unlockAudio();
    setTimeout(startListening, 300);
  }, [buildRecognition, startListening]);

  const stopAudio = useCallback(() => {
    stopSpeaking();
    setAudioLoading(false);
    if (activeRef.current) {
      setState("listening");
      setTimeout(startListening, 250);
    } else {
      setState("idle");
    }
  }, [startListening]);

  const stopVoice = useCallback(() => {
    setActive(false);
    activeRef.current = false;
    stopSpeaking();
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
    setInterim("");
    setState("idle");
  }, []);

  const handleNewChat = useCallback(() => {
    stopSpeaking();
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
    setTurns([]);
    setInterim("");
    setError(null);
    setTextInput("");
    if (activeRef.current) {
      setState("listening");
      setTimeout(startListening, 300);
    } else {
      setState("idle");
    }
  }, [startListening]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || state === "thinking") return;
    const query = textInput.trim();
    setTextInput("");
    void ask(query);
  };

  useEffect(() => {
    return () => {
      stopVoice();
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, [stopVoice]);

  return (
    <main
      id="thanafus-app-root"
      className="hero-bg relative flex min-h-screen flex-col items-center px-4 py-6 text-foreground"
    >
      {/* Top Header Bar */}
      <header className="w-full max-w-2xl flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/40">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">THANAFUS AI</h1>
            <p className="text-xs text-muted-foreground">Art Fest 2026 • Powered by Gemini</p>
          </div>
        </div>

        <button
          id="new-chat-button"
          onClick={handleNewChat}
          title="Start a new chat conversation"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-medium hover:bg-secondary hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5 text-primary" />
          New Chat
        </button>
      </header>

      {/* Voice Assistant Centerpiece */}
      <div className="mt-4 flex flex-1 flex-col items-center justify-center w-full max-w-2xl">
        <Robot state={state} />

        {/* State Pill */}
        <p
          id="status-pill"
          aria-live="polite"
          className="mt-3 rounded-full border border-border bg-card/80 px-5 py-2 text-sm font-medium shadow-sm transition-all"
        >
          {audioLoading ? "Preparing voice..." : STATUS[state]}
        </p>

        {/* Language Selection */}
        <div
          id="language-selector"
          className="mt-4 flex flex-wrap items-center justify-center gap-2"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              id={`lang-button-${l.code}`}
              onClick={() => {
                setLang(l.code);
                if (recRef.current) {
                  recRef.current.lang = l.code;
                }
              }}
              className={`rounded-full border px-3.5 py-1 text-xs font-medium transition-colors ${
                lang === l.code
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div
          id="voice-controls"
          className="mt-5 flex flex-wrap items-center justify-center gap-2.5"
        >
          {!active ? (
            <div className="flex flex-col items-center text-center">
              {!permissionAsked && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Thanafus AI-യോട് സംസാരിക്കാൻ Microphone അനുവദിക്കുക.
                </p>
              )}
              <button
                id="start-voice-button"
                onClick={() => void enableVoice()}
                disabled={!supported}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-[0_0_40px_var(--glow)] transition-transform hover:scale-[1.03] disabled:opacity-50"
              >
                <Mic className="h-5 w-5" /> Start Voice Mode
              </button>
              {!supported && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Speech recognition is not supported in this browser. You can still type below.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                id="stop-voice-mode-button"
                onClick={stopVoice}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                <MicOff className="h-4 w-4 text-destructive" />
                Stop Voice Mode
              </button>
              {(state === "speaking" || audioLoading) && (
                <button
                  id="stop-audio-button"
                  onClick={stopAudio}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  <Square className="h-4 w-4 text-primary" />
                  Mute Voice
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <p id="error-message" className="mt-3 max-w-md text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Suggested Quick Questions */}
      {turns.length === 0 && !interim && (
        <div
          id="suggested-questions"
          className="mt-4 flex w-full max-w-2xl flex-wrap justify-center gap-2"
        >
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => void ask(s)}
              className="rounded-full border border-border/70 bg-card/50 px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Conversation Log / Chat History */}
      <section id="chat-history-section" className="mt-5 w-full max-w-2xl">
        <div
          ref={logRef}
          id="chat-turns-container"
          className="max-h-64 sm:max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/70 p-4 shadow-inner backdrop-blur-sm"
        >
          {turns.length === 0 && !interim && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <p className="font-medium">സംസാരിച്ചു തുടങ്ങൂ അല്ലെങ്കിൽ താഴെ ചോദിക്കൂ</p>
              <p className="text-xs mt-1 text-muted-foreground/80">
                Ask about Thanafus 2026, programs, rules, officials, or any educational question.
              </p>
            </div>
          )}

          {turns.map((t) => (
            <div
              key={t.id}
              className={`flex flex-col text-sm leading-relaxed p-2.5 rounded-xl border ${
                t.role === "user"
                  ? "border-accent/30 bg-accent/10 ml-6"
                  : "border-primary/20 bg-primary/5 mr-6"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {t.role === "user" ? (
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                    You
                  </span>
                ) : (
                  <div className="flex items-center gap-1 text-xs font-semibold text-primary uppercase tracking-wider">
                    <Volume2 className="h-3 w-3" />
                    <span>Thanafus AI</span>
                  </div>
                )}
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{t.content}</p>
            </div>
          ))}

          {interim && (
            <div className="p-2.5 rounded-xl border border-accent/20 bg-accent/5 ml-6 text-sm italic text-muted-foreground">
              <span className="text-xs font-semibold text-accent mr-1.5">You:</span>
              <span>{interim}</span>
            </div>
          )}
        </div>

        {/* Text Input Companion Bar */}
        <form onSubmit={handleTextSubmit} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            id="chat-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              lang === "ml-IN"
                ? "ഇവിടെ ചോദ്യം ചോദിക്കാം..."
                : lang === "ar-SA"
                  ? "اكتب سؤالك هنا..."
                  : "Type a question or message..."
            }
            disabled={state === "thinking"}
            className="flex-1 rounded-full border border-border bg-card/80 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            id="send-message-button"
            disabled={!textInput.trim() || state === "thinking"}
            aria-label="Send question"
            className="rounded-full bg-primary p-2.5 text-primary-foreground shadow-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
}
