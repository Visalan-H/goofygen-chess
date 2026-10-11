import { ReactNode, useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";

// Shows a bar once the live connection has been down for a moment, so a frozen board explains itself.
function ConnectionBar() {
  const { hasEverConnected, isWebSocketConnected } = useConvexConnectionState();
  const down = hasEverConnected && !isWebSocketConnected;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => setShow(true), 1500);
    return () => {
      clearTimeout(timer);
      setShow(false);
    };
  }, [down]);

  if (!down || !show) return null;
  return (
    <div role="status" className="absolute inset-x-0 top-0 z-40 bg-foreground text-primary-foreground text-center text-sm font-medium py-1.5">
      Connection lost. Reconnecting...
    </div>
  );
}

// The shell always fills the viewport. Views scroll inside it, so the page itself never does.
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell bg-background flex items-center justify-center sm:p-4 overflow-hidden">
      <div className="relative w-full h-full glass overflow-hidden sm:rounded-xl flex flex-col min-h-0">
        <ConnectionBar />
        {children}
      </div>
    </div>
  );
}
