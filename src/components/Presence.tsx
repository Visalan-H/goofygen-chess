import { useEffect, useState } from "react";

// Heartbeats arrive every 20s, but a backgrounded tab may only fire once a minute.
const GONE_AFTER_MS = 90_000;
const HINT_AFTER_MS = 120_000;

function span(ms: number) {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "";
  if (m < 60) return ` ${m}m`;
  return ` ${Math.floor(m / 60)}h`;
}

type PresenceProps = {
  lastSeen: number;
  online: boolean;
  // Server time when the numbers were read, so a wrong phone clock does not matter
  serverNow: number;
  canResign: boolean;
};

export function Presence({ lastSeen, online, serverNow, canResign }: PresenceProps) {
  const [skew, setSkew] = useState(() => serverNow - Date.now());
  const [, setTick] = useState(0);

  useEffect(() => {
    setSkew(serverNow - Date.now());
  }, [serverNow]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const age = Date.now() + skew - lastSeen;
  const gone = !online || age > GONE_AFTER_MS;

  if (!gone) {
    return (
      <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        Online
      </span>
    );
  }
  return (
    <span role="status" className="ml-auto flex items-center gap-1.5 text-xs font-medium text-destructive shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
      Disconnected{span(age)}
      {canResign && age > HINT_AFTER_MS && <span className="text-muted-foreground font-normal">You can resign.</span>}
    </span>
  );
}
