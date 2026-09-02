"use client";

import { useCallback, useRef, useState } from "react";
import { DEFAULT_BOOK_URL } from "@/lib/sales/outreach/bookUrl";
import { insertMarkdownLink, prepareOutboundEmail, sanitizeHttpUrl } from "@/lib/sales/outreach/email-html";
import EmailSignaturePreview from "@/components/sales/EmailSignaturePreview";

type LinkForm = {
  start: number;
  end: number;
  text: string;
  url: string;
};

export default function EmailDraftEditor({
  value,
  onChange,
  onBlur,
  disabled = false,
  rows = 12,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkForm, setLinkForm] = useState<LinkForm | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const captureSelection = useCallback((): { start: number; end: number; selected: string } => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    return { start, end, selected: value.slice(start, end) };
  }, [value]);

  const restoreCursor = useCallback((cursor: number) => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }, []);

  const openLinkForm = useCallback(() => {
    const { start, end, selected } = captureSelection();
    const trimmed = selected.trim();
    const looksLikeUrl = Boolean(sanitizeHttpUrl(trimmed));
    setLinkError(null);
    setLinkForm({
      start,
      end,
      text: looksLikeUrl ? "" : selected,
      url: looksLikeUrl ? trimmed : "",
    });
  }, [captureSelection]);

  const applyLink = useCallback(() => {
    if (!linkForm) return;
    const result = insertMarkdownLink(value, linkForm.start, linkForm.end, linkForm.url, linkForm.text);
    if ("error" in result) {
      setLinkError(result.error);
      return;
    }
    onChange(result.body);
    setLinkForm(null);
    setLinkError(null);
    restoreCursor(result.cursor);
  }, [linkForm, onChange, restoreCursor, value]);

  const insertBookLink = useCallback(() => {
    const { start, end, selected } = captureSelection();
    const label = selected.trim() || "crowdsourcechoir.com/book";
    const result = insertMarkdownLink(value, start, end, DEFAULT_BOOK_URL, label);
    if ("error" in result) {
      setLinkError(result.error);
      return;
    }
    onChange(result.body);
    setLinkForm(null);
    setLinkError(null);
    restoreCursor(result.cursor);
  }, [captureSelection, onChange, restoreCursor, value]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={openLinkForm}
          className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          Add link
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={insertBookLink}
          className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          Insert book page
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
        >
          {showPreview ? "Hide preview" : "Preview links & signature"}
        </button>
        <span className="text-[11px] text-gray-500">Select text first, or type a label in the link fields.</span>
      </div>
      {linkForm && (
        <div className="rounded-md border border-gray-700 bg-gray-950 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs text-gray-400">
              Link text
              <input
                value={linkForm.text}
                onChange={(e) => setLinkForm({ ...linkForm, text: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white"
                placeholder="What the reader clicks"
              />
            </label>
            <label className="block text-xs text-gray-400">
              URL
              <input
                value={linkForm.url}
                onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white"
                placeholder="https://"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
              />
            </label>
          </div>
          {linkError && <p className="mt-2 text-xs text-red-400">{linkError}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={applyLink}
              className="rounded-md bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600"
            >
              Insert link
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkForm(null);
                setLinkError(null);
              }}
              className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
      />
      {showPreview && (
        <div className="rounded-md border border-gray-700 bg-white px-3 py-2 text-sm text-gray-900">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-500">How the email will look</p>
          <div dangerouslySetInnerHTML={{ __html: prepareOutboundEmail(value).html }} />
        </div>
      )}
      <div className="rounded-md border border-gray-800 bg-black/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-gray-600">Signature added to every send</p>
        <EmailSignaturePreview className="mt-1" />
      </div>
    </div>
  );
}
