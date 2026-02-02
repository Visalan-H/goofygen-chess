import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-zinc-800 selection:text-white">
      <div className="w-full max-w-5xl bg-zinc-950 shadow-2xl border border-border overflow-hidden md:rounded-lg">
        {children}
      </div>
      <div className="mt-8 text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
        Realtime Chess • React + Convex
      </div>
    </div>
  );
}
