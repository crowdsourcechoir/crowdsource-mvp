"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  editorHtmlToMarkdown,
  markdownToEditorHtml,
  pasteToMarkdown,
} from "@/lib/sales/outreach/email-body-format";

type QueueEmailBodyEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
};

function runCommand(command: string): void {
  document.execCommand(command, false);
}

export default function QueueEmailBodyEditor({ value, onChange, onBlur, disabled }: QueueEmailBodyEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const skipNextValueSync = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (skipNextValueSync.current) {
      skipNextValueSync.current = false;
      return;
    }
    const html = markdownToEditorHtml(value);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const emitMarkdown = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    skipNextValueSync.current = true;
    onChange(editorHtmlToMarkdown(el.innerHTML));
  }, [onChange]);

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const html = event.clipboardData.getData("text/html");
      const plain = event.clipboardData.getData("text/plain");
      const markdown = pasteToMarkdown(html, plain);
      const fragment = markdownToEditorHtml(markdown);
      document.execCommand("insertHTML", false, fragment);
      emitMarkdown();
    },
    [emitMarkdown]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.shiftKey && event.key === "8") {
        event.preventDefault();
        runCommand("insertUnorderedList");
        emitMarkdown();
        return;
      }
      if (meta && event.shiftKey && (event.key === "7" || event.key === "&")) {
        event.preventDefault();
        runCommand("insertOrderedList");
        emitMarkdown();
      }
    },
    [emitMarkdown]
  );

  const applyList = useCallback(
    (kind: "ul" | "ol") => {
      editorRef.current?.focus();
      runCommand(kind === "ul" ? "insertUnorderedList" : "insertOrderedList");
      emitMarkdown();
    },
    [emitMarkdown]
  );

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyList("ul")}
          className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          title="Bulleted list"
        >
          Bullets
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyList("ol")}
          className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          title="Numbered list"
        >
          Numbers
        </button>
        <span className="pl-1 text-[11px] text-gray-500">Paste keeps lists</span>
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="Email body"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitMarkdown}
        onBlur={() => {
          emitMarkdown();
          onBlur?.();
        }}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className="queue-email-body-editor min-h-[16rem] w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-gray-500 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5"
      />
    </div>
  );
}
