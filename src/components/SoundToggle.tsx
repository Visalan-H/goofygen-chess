import { useState } from "react";
import { isMuted, setMuted } from "../lib/feedback";

// Mutes sounds and haptics together, and remembers the choice on this device
export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);

  function toggle() {
    setMuted(!muted);
    setMutedState(!muted);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Mute sound and vibration"
      aria-pressed={muted}
      title={muted ? "Sound off" : "Sound on"}
      className="-my-2 flex h-10 w-10 items-center justify-center text-zinc-400 transition-colors hover:text-foreground"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" />
        {muted ? (
          <path d="m16 9 6 6m0-6-6 6" />
        ) : (
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        )}
      </svg>
    </button>
  );
}
