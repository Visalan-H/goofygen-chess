import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center md:p-4 relative">
       {/* Background Glow */}
       <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-5xl bg-zinc-950/80 backdrop-blur-3xl md:shadow-2xl md:border border-zinc-800 overflow-hidden md:rounded-xl min-h-screen md:min-h-0 relative z-10">
        {children}
      </div>
      <div className="mt-6 text-[10px] text-zinc-600 tracking-wider hidden md:block relative z-10">
        Built with React + Convex
      </div>
    </div>
  );
}
