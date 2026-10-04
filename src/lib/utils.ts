import { ConvexError } from "convex/values";

// crypto.randomUUID only exists in secure contexts, so plain-http LAN testing
// (vite is bound to 0.0.0.0) needs a fallback.
export function generateUUID() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Production Convex hides plain Error messages, so the backend throws ConvexError.
export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "string") return err.data;
  return "Something went wrong. Try again.";
}
