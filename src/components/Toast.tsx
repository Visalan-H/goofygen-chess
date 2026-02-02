import { useState, useCallback, createContext, useContext } from "react";

type Toast = { id: string; message: string; type: "info" | "success" | "error" };
type ToastContextType = { toast: (message: string, type?: "info" | "success" | "error") => void };

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-xl border backdrop-blur-sm text-sm font-medium
              ${t.type === "error" ? "bg-red-950/90 border-red-800 text-red-100" : ""}
              ${t.type === "success" ? "bg-green-950/90 border-green-800 text-green-100" : ""}
              ${t.type === "info" ? "bg-zinc-900/95 border-zinc-700 text-zinc-100" : ""}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
