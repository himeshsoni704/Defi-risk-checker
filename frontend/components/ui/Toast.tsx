"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import Icon from "./Icon";

type ToastTone = "good" | "bad" | "warn" | "iris";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const ToastContext = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ICON: Record<ToastTone, string> = { good: "check", bad: "alert", warn: "alert", iris: "info" };
const BG: Record<ToastTone, string> = {
  good: "var(--good-soft)",
  bad: "var(--bad-soft)",
  warn: "var(--warn-soft)",
  iris: "var(--iris-soft)",
};
const FG: Record<ToastTone, string> = { good: "var(--good)", bad: "var(--bad)", warn: "var(--warn)", iris: "var(--iris-2)" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = nextId.current++;
      setItems((l) => [...l.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "bad" ? 8000 : 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span className="toast-icon" style={{ background: BG[t.tone], color: FG[t.tone] }}>
              <Icon name={ICON[t.tone]} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="toast-title">{t.title}</div>
              {t.body && <div className="toast-body">{t.body}</div>}
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
