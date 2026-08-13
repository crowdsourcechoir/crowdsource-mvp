"use client";

import {
  useCallback,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";

type FileDropZoneProps = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Compact chip/button style (hero upload). */
  variant?: "panel" | "compact" | "inline";
  className?: string;
  label?: ReactNode;
  hint?: ReactNode;
  onFiles: (files: File[]) => void | Promise<void>;
};

function acceptMatches(file: File, accept: string | undefined): boolean {
  if (!accept || accept.trim() === "" || accept.trim() === "*") return true;
  const tokens = accept.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return tokens.some((token) => {
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1);
      return type.startsWith(prefix);
    }
    if (token.startsWith(".")) {
      return name.endsWith(token);
    }
    return type === token;
  });
}

/**
 * Shared click + drag-and-drop file picker for admin and public upload UIs.
 */
export default function FileDropZone({
  accept,
  multiple = false,
  disabled = false,
  variant = "panel",
  className = "",
  label,
  hint,
  onFiles,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const emitFiles = useCallback(
    async (list: FileList | File[] | null) => {
      if (!list || disabled) return;
      const raw = Array.from(list);
      const filtered = accept ? raw.filter((f) => acceptMatches(f, accept)) : raw;
      if (filtered.length === 0) return;
      const next = multiple ? filtered : filtered.slice(0, 1);
      await onFiles(next);
    },
    [accept, disabled, multiple, onFiles]
  );

  const onDragEnter = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDragOver = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    void emitFiles(e.dataTransfer.files);
  };

  const defaultLabel =
    variant === "compact"
      ? "Upload"
      : multiple
        ? "Drop files here or click to browse"
        : "Drop a file here or click to browse";

  const basePanel =
    "relative flex flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center transition";
  const panelIdle = "border-gray-700 bg-[#1a1a1a] text-gray-400 hover:border-gray-500 hover:bg-[#222]";
  const panelActive = "border-[#CFFF81]/70 bg-[#CFFF81]/10 text-[#CFFF81]";
  const panelDisabled = "pointer-events-none opacity-50";

  const compactBase =
    "relative inline-flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition";
  const compactIdle =
    "border-gray-700 bg-[#222] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-300";
  const compactActive = "border-[#CFFF81]/60 bg-[#CFFF81]/10 text-[#CFFF81]";

  const inlineBase =
    "relative block w-full cursor-pointer rounded-lg border border-dashed px-3 py-3 text-left text-xs transition";
  const inlineIdle = "border-gray-700 bg-[#1a1a1a] text-gray-400 hover:border-gray-500";
  const inlineActive = "border-[#CFFF81]/70 bg-[#CFFF81]/10 text-[#CFFF81]";

  let classNames = "";
  if (variant === "compact") {
    classNames = `${compactBase} ${dragging ? compactActive : compactIdle} ${disabled ? panelDisabled : ""} ${className}`;
  } else if (variant === "inline") {
    classNames = `${inlineBase} ${dragging ? inlineActive : inlineIdle} ${disabled ? panelDisabled : ""} ${className}`;
  } else {
    classNames = `${basePanel} ${dragging ? panelActive : panelIdle} ${disabled ? panelDisabled : ""} ${className}`;
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={classNames}
      onClick={() => {
        if (disabled) return;
        inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          void emitFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span className={variant === "panel" ? "text-sm font-medium" : undefined}>
        {label ?? defaultLabel}
      </span>
      {hint && variant !== "compact" ? (
        <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>
      ) : null}
      {dragging && variant === "panel" ? (
        <span className="mt-1 text-[11px] text-[#CFFF81]">Drop to upload</span>
      ) : null}
    </div>
  );
}
