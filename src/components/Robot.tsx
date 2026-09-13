export type RobotState = "idle" | "listening" | "thinking" | "speaking";

export function Robot({ state }: { state: RobotState }) {
  return (
    <div
      id="voice-orb-container"
      className="relative flex h-60 w-60 items-center justify-center sm:h-72 sm:w-72 select-none"
    >
      {/* Listening State: Acoustic Radar / Expanding Aura Rings */}
      {state === "listening" && (
        <>
          <span className="absolute inset-4 rounded-full border border-primary/40 animate-pulse-ring" />
          <span
            className="absolute inset-4 rounded-full border border-primary/25 animate-pulse-ring"
            style={{ animationDelay: "0.65s" }}
          />
          <span
            className="absolute inset-4 rounded-full border border-primary/15 animate-pulse-ring"
            style={{ animationDelay: "1.3s" }}
          />
        </>
      )}

      {/* Thinking State: Elegant Iridescent Spinning Orbit */}
      {state === "thinking" && (
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }}>
          <div className="absolute left-1/2 top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_20px_var(--accent)]" />
          <div className="absolute bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_16px_var(--primary)]" />
        </div>
      )}

      {/* Speaking State: Harmonic Audio Ring expansion */}
      {state === "speaking" && (
        <div className="absolute inset-2 rounded-full border border-primary/30 animate-ping opacity-25" />
      )}

      {/* Main Professional Glowing Orb */}
      <div
        id="voice-orb"
        className={`relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full transition-all duration-500 shadow-2xl backdrop-blur-md ${
          state === "listening"
            ? "scale-105 bg-gradient-to-tr from-primary/30 via-secondary to-primary/20 border-2 border-primary shadow-[0_0_50px_var(--glow)]"
            : state === "thinking"
              ? "scale-95 bg-gradient-to-tr from-accent/30 via-secondary to-primary/30 border border-accent/60 shadow-[0_0_40px_oklch(0.72_0.19_320/35%)]"
              : state === "speaking"
                ? "scale-105 bg-gradient-to-tr from-primary/40 via-secondary to-accent/30 border-2 border-primary/80 shadow-[0_0_55px_var(--glow)] animate-pulse"
                : "scale-100 bg-gradient-to-tr from-card via-secondary/70 to-card border border-border shadow-[0_0_25px_oklch(0.78_0.16_190/15%)]"
        }`}
      >
        {/* Core dynamic graphic */}
        <div className="relative flex flex-col items-center justify-center">
          {state === "speaking" ? (
            /* Live Equalizer sound waves */
            <div className="flex h-12 items-center gap-1.5 px-2">
              {[0.4, 0.9, 0.6, 1.0, 0.7, 0.5, 0.8].map((scale, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)] animate-bar"
                  style={{
                    height: `${scale * 36}px`,
                    animationDelay: `${i * 0.12}s`,
                    animationDuration: "0.8s",
                  }}
                />
              ))}
            </div>
          ) : state === "listening" ? (
            /* Dynamic active audio wave line */
            <div className="flex h-10 items-center gap-1.5">
              {[0.5, 0.8, 1.0, 0.8, 0.5].map((scale, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)] animate-bar"
                  style={{
                    height: `${scale * 28}px`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: "1s",
                  }}
                />
              ))}
            </div>
          ) : state === "thinking" ? (
            /* Pulsing thinking core */
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
              <span className="h-3 w-3 rounded-full bg-accent/80 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-3 w-3 rounded-full bg-primary animate-bounce" />
            </div>
          ) : (
            /* Idle calm pulse core */
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <div className="h-4 w-4 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
