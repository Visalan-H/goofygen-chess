import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-zinc-950 shadow-2xl border border-zinc-800 overflow-hidden rounded-xl">
        {children}
      </div>
      <div className="mt-6 text-[10px] text-zinc-600 tracking-wider">
        Built with React + Convex
      </div>
    </div>
  );
}
