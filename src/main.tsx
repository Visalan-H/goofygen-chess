import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ToastProvider } from "./components/Toast";
import { ConfirmProvider } from "./components/Confirm";

// No "Leave site?" prompt: the stuck-connection reload in App runs while a check-in is in flight,
// and a lost heartbeat or move is safe to drop since the game state lives on the server.
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string, { unsavedChangesWarning: false });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </ConvexProvider>
  </React.StrictMode>,
)

