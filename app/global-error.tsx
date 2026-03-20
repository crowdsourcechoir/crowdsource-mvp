"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Keep this UI minimal so Next can always render it.
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        background: "#f9fafb",
        padding: "1rem",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111" }}>Something went wrong</h1>
      <p style={{ marginTop: "0.5rem", color: "#4b5563" }}>Please try again.</p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: "1.5rem",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          cursor: "pointer",
          background: "#111",
          color: "#fff",
          border: "none",
          borderRadius: "0.5rem",
        }}
      >
        Try again
      </button>
      {process.env.NODE_ENV !== "production" && (
        <pre style={{ marginTop: "1rem", color: "#6b7280", whiteSpace: "pre-wrap", maxWidth: 800 }}>
          {String(error?.message || error)}
        </pre>
      )}
    </div>
  );
}

