// Move sounds and haptics. The samples in public/sounds are CC0 recordings, see CREDITS.md there.

export type MoveKind = "move" | "capture" | "castle" | "check" | "mate";

const MOVE_SAMPLES = ["move-1", "move-2", "move-3"] as const;
const SAMPLES = [...MOVE_SAMPLES, "capture"] as const;
type Sample = (typeof SAMPLES)[number];

const buffers = new Map<Sample, AudioBuffer>();
let preloaded = false;
let ctx: AudioContext | null = null;
let lastMoveSample = 0;

// An offline context decodes without a user gesture, so the first move has its sound ready
export function preloadSounds() {
  if (preloaded || typeof OfflineAudioContext === "undefined") return;
  preloaded = true;
  const decoder = new OfflineAudioContext(1, 1, 44100);
  for (const name of SAMPLES) {
    fetch(`${import.meta.env.BASE_URL}sounds/${name}.wav`)
      .then((res) => res.arrayBuffer())
      .then((data) => decoder.decodeAudioData(data))
      .then((buffer) => buffers.set(name, buffer))
      .catch(() => {
        // A missing sample only costs that sound. Haptics still fire.
      });
  }
}

function audio(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  // Browsers suspend audio until the first tap or click
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function hit(c: AudioContext, sample: Sample, at: number, gain = 1, rate = 1) {
  const buffer = buffers.get(sample);
  if (!buffer) return;
  const source = c.createBufferSource();
  const amp = c.createGain();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  amp.gain.value = gain;
  source.connect(amp).connect(c.destination);
  source.start(at);
}

// Three takes in rotation, so repeated moves don't sound like a machine gun
function nextMoveSample() {
  lastMoveSample = (lastMoveSample + 1) % MOVE_SAMPLES.length;
  return MOVE_SAMPLES[lastMoveSample];
}

const SOUNDS: Record<MoveKind, (c: AudioContext, t: number) => void> = {
  move: (c, t) => hit(c, nextMoveSample(), t, 0.7),
  capture: (c, t) => hit(c, "capture", t),
  // The king lands, then the rook
  castle: (c, t) => {
    hit(c, "move-1", t, 0.75);
    hit(c, "move-3", t + 0.13, 0.75);
  },
  // Two quick raps, the second pitched up
  check: (c, t) => {
    hit(c, "capture", t);
    hit(c, "capture", t + 0.1, 0.7, 1.18);
  },
  // Three raps that fall in pitch and slow down
  mate: (c, t) => {
    hit(c, "capture", t);
    hit(c, "capture", t + 0.14, 0.9, 0.9);
    hit(c, "capture", t + 0.36, 1, 0.68);
  },
};

const HAPTICS: Record<MoveKind, number | number[]> = {
  move: 10,
  capture: [18, 30, 22],
  castle: [10, 30, 10],
  check: [30, 40, 30],
  mate: [40, 50, 40, 50, 90],
};

const MUTE_KEY = "goofygen:muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode: the mute lasts only for this page load
  }
}

export function moveFeedback(kind: MoveKind) {
  if (isMuted()) return;
  const c = audio();
  if (c) SOUNDS[kind](c, c.currentTime);
  // iOS Safari has no vibrate API, so this is a no-op there
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(HAPTICS[kind]);
  }
}
