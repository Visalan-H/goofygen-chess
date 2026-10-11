import { useEffect, useState } from "react";

// Heartbeats arrive every 20s, but a backgrounded tab may only fire once a minute.
const GONE_AFTER_MS = 90_000;
const HINT_AFTER_MS = 120_000;
const TICK_MS = 5000;

function span(ms: number) {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "";
  if (m < 60) return ` ${m}m`;
  return ` ${Math.floor(m / 60)}h`;
}

type PresenceProps = {
  lastSeen: number;
  online: boolean;
  // Server time when the numbers were read
  serverNow: number;
  canResign: boolean;
};

// Every fresh reading from the server remounts the body, which restarts its clock
export function Presence(props: PresenceProps) {
  return <PresenceBody key={props.serverNow} {...props} />;
}

function PresenceBody({ lastSeen, online, serverNow, canResign }: PresenceProps) {
  // Counts up from the server reading, so the phone clock never enters the math
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const age = serverNow - lastSeen + elapsed;
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
