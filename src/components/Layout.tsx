import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] md:min-h-screen bg-background flex flex-col items-center justify-center md:p-4 relative overflow-hidden md:overflow-visible">
      <div className="w-full max-w-7xl h-full md:h-auto glass md:shadow-2xl overflow-hidden md:rounded-xl relative z-10 flex flex-col">
        {children}
      </div>
    </div>
  );
}

