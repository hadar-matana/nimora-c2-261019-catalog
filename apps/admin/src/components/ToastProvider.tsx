"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

type ToastKind = "success" | "error";
type Toast = { id: number; message: string; kind: ToastKind };
type Notifications = {
  notify: (message: string, kind?: ToastKind) => void;
  dismissAll: () => void;
};
const Context = createContext<Notifications | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const sequence = useRef(0);
  const dismissAll = useCallback(() => setToast(null), []);
  const notify = useCallback((message: string, kind: ToastKind = "success") => {
    // One consistent slot: the newest result replaces the previous notification.
    setToast(message ? { id: ++sequence.current, message, kind } : null);
  }, []);
  useEffect(() => {
    if (!toast || toast.kind !== "success") return;
    const id = toast.id;
    const timer = setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      4000,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  function notification(kind: ToastKind) {
    if (toast?.kind !== kind) return null;
    const Icon = kind === "success" ? CheckCircle2 : CircleAlert;
    return (
      <div key={toast.id} className={`toast toast-${kind}`}>
        <Icon className="toast-icon" size={19} strokeWidth={1.6} aria-hidden="true" />
        <span>{toast.message}</span>
        <button type="button" className="icon-button" aria-label="סגירת הודעה" onClick={dismissAll}>
          <X size={17} />
        </button>
      </div>
    );
  }
  return (
    <Context.Provider value={{ notify, dismissAll }}>
      {children}
      <div className="toast-viewport" dir="rtl">
        <div role="status" aria-atomic="true">
          {notification("success")}
        </div>
        <div role="alert" aria-atomic="true">
          {notification("error")}
        </div>
      </div>
    </Context.Provider>
  );
}

export function useToast() {
  const notifications = useContext(Context);
  if (!notifications) throw new Error("ToastProvider is required");
  return notifications;
}
