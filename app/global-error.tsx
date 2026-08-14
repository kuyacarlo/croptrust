"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#fafaf9",
            color: "#292524",
          }}
        >
          <AlertTriangle size={40} color="#d97706" />
          <h2 style={{ marginTop: "1rem", fontSize: "1.25rem", fontWeight: 700 }}>
            The application crashed
          </h2>
          <p style={{ marginTop: "0.5rem", maxWidth: "24rem", fontSize: "0.875rem", color: "#78716c" }}>
            A critical error prevented the app from rendering. Please try reloading.
          </p>
          {error?.digest && (
            <p style={{ marginTop: "0.5rem", fontFamily: "monospace", fontSize: "0.7rem", color: "#a8a29e" }}>
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#14532d",
              color: "#fff",
              padding: "0.6rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
