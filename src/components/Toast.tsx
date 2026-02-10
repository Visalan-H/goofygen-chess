import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

type ToastType = "info" | "success" | "error";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      theme="dark"
      closeButton
    />
  );
}

// Hook for compatibility with existing code
export function useToast() {
  const toast = (message: string, type: ToastType = "info") => {
    switch (type) {
      case "success":
        sonnerToast.success(message);
        break;
      case "error":
        sonnerToast.error(message);
        break;
      case "info":
      default:
        sonnerToast(message);
        break;
    }
  };

  return { toast };
}

// Deprecated Provider - just renders children + Toaster
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
