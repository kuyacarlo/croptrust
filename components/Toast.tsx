"use client";

import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { CheckCircle, XCircle, X, Loader2 } from "lucide-react";

type Toast = { id: number; message: string; type: "success" | "error" | "loading" };

const ToastContext = createContext<{
  toast: (msg: string, type: Toast["type"]) => number;
  dismiss: (id: number) => void;
} | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: Toast["type"]) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type !== "loading") {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }
    return id;
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast: add, dismiss: remove }}>
      {children}
      <div className="fixed left-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur transition-all animate-in slide-in-from-top-2 ${
              t.type === "success"
                ? "border-farm-200 bg-farm-50 text-farm-800"
                : t.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-stone-200 bg-white text-stone-600"
            }`}
          >
            {t.type === "success" ? <CheckCircle size={16} className="text-farm-600" />
              : t.type === "error" ? <XCircle size={16} className="text-red-600" />
              : <Loader2 size={16} className="animate-spin" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export type { Toast };
