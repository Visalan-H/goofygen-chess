import { ReactNode } from "react";

// The shell always fills the viewport. Views scroll inside it, so the page itself never does.
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell bg-background flex items-center justify-center sm:p-4 overflow-hidden">
      <div className="w-full h-full glass overflow-hidden sm:rounded-xl flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}
