import { useState, createContext, useContext, useCallback } from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

type ConfirmContextType = { confirm: (options: ConfirmOptions) => Promise<boolean> };

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, options: { title: "", message: "" }, resolve: null });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => setState({ open: true, options, resolve }));
  }, []);

  const handleConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const { open, options } = state;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={handleCancel} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white">{options.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{options.message}</p>
            </div>
            <div className="flex justify-end gap-3 p-4 pt-0">
              <button onClick={handleCancel} className="btn btn-ghost">
                {options.cancelText || "Cancel"}
              </button>
              <button onClick={handleConfirm} className={`btn ${options.variant === "destructive" ? "btn-destructive" : "btn-primary"}`}>
                {options.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
