"use client";

import { useCallback, useEffect, useState } from "react";
import EmailLaunchLink from "@/components/sales/EmailLaunchLink";

type GmailComposeWindowProps = {
  toName?: string | null;
  toEmail: string;
  fromEmail?: string | null;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onBlurSave?: () => void;
  onSend: () => void;
  onImprove: (instruction?: string) => void;
  improving?: boolean;
  busy?: boolean;
  sendDisabled?: boolean;
  copyStatus?: string | null;
};

function IconMinimize() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M5 12.75h14v1.5H5z" />
    </svg>
  );
}

function IconPopOut() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v6H4V4h6" />
    </svg>
  );
}

function IconPopIn() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M15 9h-6v6" />
      <path d="M4 20 10 14" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function IconPolish() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2.5 13.7 8h5.8l-4.7 3.4 1.8 5.6L12 13.9 7.4 17l1.8-5.6L4.5 8h5.8L12 2.5Z" />
    </svg>
  );
}

/**
 * Gmail-style compose: To/Subject stay put, the body scrolls, pop-out opens a larger window.
 */
export default function GmailComposeWindow({
  toName,
  toEmail,
  fromEmail,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onBlurSave,
  onSend,
  onImprove,
  improving = false,
  busy = false,
  sendDisabled = false,
  copyStatus,
}: GmailComposeWindowProps) {
  const [poppedOut, setPoppedOut] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [instruction, setInstruction] = useState("");

  const popIn = useCallback(() => {
    setPoppedOut(false);
    setMinimized(false);
  }, []);

  const popOut = useCallback(() => {
    setPoppedOut(true);
    setMinimized(false);
  }, []);

  useEffect(() => {
    if (!poppedOut && !minimized) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (minimized) {
        setMinimized(false);
        return;
      }
      popIn();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [poppedOut, minimized, popIn]);

  useEffect(() => {
    if (!poppedOut) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [poppedOut]);

  const toLabel = !toEmail.trim()
    ? "No recipient"
    : toName?.trim()
      ? `${toName.trim()} <${toEmail}>`
      : toEmail;

  const chrome = (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-300 bg-white text-gray-900 shadow-2xl ${
        poppedOut ? "h-full" : "h-[32rem]"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between bg-[#404040] px-3 py-2 text-white">
        <p className="text-sm font-medium">New Message</p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => setMinimized(true)}
            className="rounded p-1 hover:bg-white/10"
          >
            <IconMinimize />
          </button>
          {poppedOut ? (
            <button
              type="button"
              title="Pop in"
              aria-label="Pop in"
              onClick={popIn}
              className="rounded p-1 hover:bg-white/10"
            >
              <IconPopIn />
            </button>
          ) : (
            <button
              type="button"
              title="Pop out"
              aria-label="Pop out"
              onClick={popOut}
              className="rounded p-1 hover:bg-white/10"
            >
              <IconPopOut />
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 border-b border-gray-200 px-3">
        {fromEmail ? (
          <div className="flex items-baseline gap-2 border-b border-gray-100 py-2 text-sm">
            <span className="w-10 shrink-0 text-gray-500">From</span>
            <span className="truncate text-gray-800">{fromEmail}</span>
          </div>
        ) : null}
        <div className="flex items-baseline gap-2 border-b border-gray-100 py-2 text-sm">
          <span className="w-10 shrink-0 text-gray-500">To</span>
          <span className="min-w-0 truncate font-medium text-gray-900" title={toLabel}>
            {toLabel}
          </span>
        </div>
        <div className="flex items-baseline gap-2 py-2 text-sm">
          <span className="w-10 shrink-0 text-gray-500">Subject</span>
          <input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            onBlur={onBlurSave}
            aria-label="Subject"
            className="min-w-0 flex-1 bg-transparent text-gray-900 outline-none"
          />
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        onBlur={onBlurSave}
        aria-label="Email body"
        className="min-h-0 w-full flex-1 resize-none overflow-y-auto bg-white px-3 py-3 text-sm leading-relaxed text-gray-800 outline-none"
      />

      <div className="shrink-0 space-y-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Describe your change"
            aria-label="Describe your change"
            className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-sky-500"
          />
          <button
            type="button"
            disabled={busy || improving}
            onClick={() => {
              onImprove(instruction.trim() || undefined);
              setInstruction("");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50"
          >
            <IconPolish />
            {improving ? "Polishing…" : "Polish"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || sendDisabled}
            onClick={onSend}
            className="rounded-md bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0a50c2] disabled:opacity-50"
          >
            Send
          </button>
          <EmailLaunchLink to={toEmail} subject={subject} body={body} />
          {copyStatus ? <span className="text-xs text-emerald-700">{copyStatus}</span> : null}
        </div>
      </div>
    </div>
  );

  const dockedSlot =
    poppedOut || minimized ? (
      <div className="rounded-xl border border-dashed border-gray-700 px-3 py-6 text-center text-sm text-gray-400">
        {minimized ? "Draft minimized — restore from the New Message bar." : "Draft is popped out for a larger view."}
      </div>
    ) : null;

  if (minimized) {
    return (
      <>
        {dockedSlot}
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed bottom-4 right-4 z-40 flex w-72 items-center justify-between rounded-t-lg bg-[#404040] px-3 py-2 text-left text-sm font-medium text-white shadow-xl"
        >
          <span>New Message</span>
          <span className="text-xs text-gray-300">Restore</span>
        </button>
      </>
    );
  }

  if (poppedOut) {
    return (
      <>
        {dockedSlot}
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gmail-compose-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) popIn();
          }}
        >
          <div className="flex h-[min(92vh,880px)] w-full max-w-4xl flex-col">
            <h2 id="gmail-compose-title" className="sr-only">
              New Message
            </h2>
            {chrome}
          </div>
        </div>
      </>
    );
  }

  return chrome;
}
