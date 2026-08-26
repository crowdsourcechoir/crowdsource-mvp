"use client";

import { useState } from "react";

type Props = {
  gardenId: string;
  editMode: boolean;
  eyebrow: string;
  message: string;
  accentColor: string;
  /** map = compact top chrome; center = large header */
  variant: "map" | "center";
  onSaved?: (next: { eyebrow: string; message: string }) => void;
};

/**
 * Hover/tap to edit world eyebrow + supporting line in live edit mode.
 */
export default function EditableWorldCopy({
  gardenId,
  editMode,
  eyebrow,
  message,
  accentColor,
  variant,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState<"eyebrow" | "message" | null>(null);
  const [draftEyebrow, setDraftEyebrow] = useState(eyebrow);
  const [draftMessage, setDraftMessage] = useState(message);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<"eyebrow" | "message" | null>(null);

  async function save( whic: "eyebrow" | "message") {
    setBusy(true);
    try {
      const presenceEyebrow = (whic === "eyebrow" ? draftEyebrow : eyebrow).trim() || null;
      const presenceMessage = (whic === "message" ? draftMessage : message).trim() || null;
      const res = await fetch(`/api/gardens/${gardenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandKit: { presenceEyebrow, presenceMessage },
          ...(whic === "eyebrow" && draftEyebrow.trim()
            ? { title: draftEyebrow.trim() }
            : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed");
      onSaved?.({
        eyebrow: presenceEyebrow || eyebrow,
        message: presenceMessage || message,
      });
      setEditing(null);
    } catch {
      /* keep editing open */
    } finally {
      setBusy(false);
    }
  }

  if (!editMode) {
    return (
      <div className={variant === "center" ? "text-center" : "text-center"}>
        <p
          className={
            variant === "center"
              ? "font-mono text-[11px] font-semibold uppercase tracking-[0.3em]"
              : "font-mono text-[10px] font-semibold uppercase tracking-[0.22em] drop-shadow sm:text-[11px]"
          }
          style={{ color: accentColor, opacity: variant === "center" ? 0.85 : 1 }}
        >
          {eyebrow}
        </p>
        <p
          className={
            variant === "center"
              ? "mt-3 text-sm text-white/70"
              : "mt-0.5 truncate text-[10px] font-medium text-white/80 drop-shadow"
          }
        >
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className={variant === "center" ? "text-center" : "text-center"}>
      {editing === "eyebrow" ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={draftEyebrow}
            onChange={(e) => setDraftEyebrow(e.target.value)}
            className="w-full rounded-lg border border-white/30 bg-black/60 px-2 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-white"
            placeholder="Eyebrow / world name"
          />
          <div className="flex justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("eyebrow")}
              className="rounded-full px-3 py-1 text-[10px] font-semibold text-black"
              style={{ background: accentColor }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftEyebrow(eyebrow);
                setEditing(null);
              }}
              className="rounded-full border border-white/30 px-3 py-1 text-[10px] text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onMouseEnter={() => setHover("eyebrow")}
          onMouseLeave={() => setHover(null)}
          onClick={() => {
            setDraftEyebrow(eyebrow);
            setEditing("eyebrow");
          }}
          className={
            variant === "center"
              ? "mx-auto block rounded-lg px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] transition"
              : "mx-auto block max-w-full rounded-lg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] drop-shadow transition sm:text-[11px]"
          }
          style={{
            color: accentColor,
            opacity: variant === "center" ? 0.85 : 1,
            outline:
              hover === "eyebrow" ? `1px dashed ${accentColor}` : "1px dashed transparent",
            background: hover === "eyebrow" ? "rgba(0,0,0,0.35)" : "transparent",
          }}
          title="Click to edit eyebrow"
        >
          {eyebrow}
          {hover === "eyebrow" ? (
            <span className="ml-2 font-sans text-[9px] normal-case tracking-normal text-white/50">
              edit
            </span>
          ) : null}
        </button>
      )}

      {editing === "message" ? (
        <div className="mt-2 space-y-2">
          <textarea
            autoFocus
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            rows={variant === "center" ? 2 : 2}
            className="w-full rounded-lg border border-white/30 bg-black/60 px-2 py-1.5 text-center text-sm text-white"
            placeholder="Supporting line under the eyebrow"
          />
          <div className="flex justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("message")}
              className="rounded-full px-3 py-1 text-[10px] font-semibold text-black"
              style={{ background: accentColor }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftMessage(message);
                setEditing(null);
              }}
              className="rounded-full border border-white/30 px-3 py-1 text-[10px] text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onMouseEnter={() => setHover("message")}
          onMouseLeave={() => setHover(null)}
          onClick={() => {
            setDraftMessage(message);
            setEditing("message");
          }}
          className={
            variant === "center"
              ? "mx-auto mt-3 block max-w-md rounded-lg px-2 py-1 text-sm text-white/70 transition"
              : "mx-auto mt-0.5 block max-w-full truncate rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-white/80 drop-shadow transition"
          }
          style={{
            outline:
              hover === "message" ? `1px dashed ${accentColor}` : "1px dashed transparent",
            background: hover === "message" ? "rgba(0,0,0,0.35)" : "transparent",
          }}
          title="Click to edit supporting text"
        >
          {message}
          {hover === "message" ? (
            <span className="ml-2 text-[9px] text-white/50">edit</span>
          ) : null}
        </button>
      )}
    </div>
  );
}
