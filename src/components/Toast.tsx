import type { ReactNode } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

type ToastType = "info" | "success" | "error";

export function Toaster() {
  return <SonnerToaster
      position="top-center"
      offset={24}
      mobileOffset={{ top: 56, left: 16, right: 16 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-full items-center gap-3 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg",
          error: "!bg-destructive !text-primary-foreground",
        },
      }}
    />;
}

// Defined once at module level so the reference stays stable across renders.
function toast(message: string, type: ToastType = "info") {
  if (type === "success") sonnerToast.success(message);
  else if (type === "error") sonnerToast.error(message);
  else sonnerToast(message);
}

const toastApi = { toast };

export function useToast() {
  return toastApi;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
