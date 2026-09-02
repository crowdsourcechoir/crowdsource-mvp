"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import { draftToEditorHtml } from "@/lib/sales/outreach/email-body-format";

type QueueEmailBodyEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  improving?: boolean;
  onImprove?: () => void;
};

const COLORS = ["#222222", "#d93025", "#1a73e8", "#188038", "#e37400", "#9334e6"];

function IconButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-200 hover:bg-gray-800 disabled:opacity-40 ${
        active ? "bg-sky-950 text-sky-200" : ""
      }`}
    >
      {children}
    </button>
  );
}

export default function QueueEmailBodyEditor({
  value,
  onChange,
  onBlur,
  disabled,
  improving,
  onImprove,
}: QueueEmailBodyEditorProps) {
  const skipSync = useRef(false);
  const lastEmitted = useRef(value);
  const [formatOpen, setFormatOpen] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Placeholder.configure({ placeholder: "Write the email…" }),
    ],
    content: draftToEditorHtml(value),
    editorProps: {
      attributes: {
        class:
          "min-h-[16rem] px-3 py-2 text-sm text-gray-200 outline-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_a]:text-sky-300 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-300 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold",
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      lastEmitted.current = html;
      skipSync.current = true;
      onChange(html);
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    if (value === lastEmitted.current) return;
    const next = draftToEditorHtml(value);
    if (editor.getHTML() !== next) editor.commands.setContent(next, false);
    lastEmitted.current = value;
  }, [editor, value]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const href = linkUrl.trim();
    if (!href) {
      editor.chain().focus().unsetLink().run();
    } else {
      const withProtocol = /^https?:\/\//i.test(href) || href.startsWith("mailto:") ? href : `https://${href}`;
      const { empty } = editor.state.selection;
      if (empty) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: withProtocol,
            marks: [{ type: "link", attrs: { href: withProtocol } }],
          })
          .run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: withProtocol }).run();
      }
    }
    setLinkOpen(false);
  }, [editor, linkUrl]);

  if (!editor) {
    return <div className="min-h-[16rem] rounded-md border border-gray-700 bg-gray-900" />;
  }

  return (
    <div className="rounded-md border border-gray-700 bg-gray-900">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-800 px-1 py-1">
        <IconButton title="Formatting options" active={formatOpen} onClick={() => setFormatOpen((open) => !open)}>
          <span className="text-[13px] font-semibold leading-none">
            A<span className="text-[10px]">a</span>
          </span>
        </IconButton>
        <IconButton
          title={improving ? "Improving…" : "Help me write"}
          disabled={!onImprove || disabled || improving}
          onClick={() => onImprove?.()}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20 16.5 7.5a2.1 2.1 0 0 1 3 3L7 23H4z" />
            <path d="m15 6 3 3" />
            <path d="M19.5 3.5 21 5M17 2.5 17.5 4M21.5 7 20 7.5" />
          </svg>
        </IconButton>
        <IconButton title="Attachments are off for cold outreach — use the book link" disabled onClick={() => undefined}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 12.5 11.2 22.3a5 5 0 0 1-7.1-7.1l12.4-12.4a3.5 3.5 0 0 1 5 5L9.2 20.1a2 2 0 1 1-2.8-2.8l10.3-10.4" />
          </svg>
        </IconButton>
        <IconButton
          title="Insert link"
          active={editor.isActive("link") || linkOpen}
          disabled={disabled}
          onClick={() => {
            setLinkUrl(editor.getAttributes("link").href || "");
            setLinkOpen((open) => !open);
          }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.23" />
            <path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13.3 18.77" />
          </svg>
        </IconButton>
      </div>

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-gray-800 px-2 py-2">
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://"
            className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded-md bg-sky-700 px-2 py-1 text-xs text-white hover:bg-sky-600"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setLinkOpen(false);
            }}
            className="rounded-md px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
          >
            Remove
          </button>
        </div>
      )}

      {formatOpen && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-800 px-1 py-1">
          <select
            aria-label="Text style"
            disabled={disabled}
            value={
              editor.isActive("heading", { level: 1 })
                ? "h1"
                : editor.isActive("heading", { level: 2 })
                  ? "h2"
                  : editor.isActive("heading", { level: 3 })
                    ? "h3"
                    : "p"
            }
            onChange={(event) => {
              const next = event.target.value;
              const chain = editor.chain().focus();
              if (next === "p") chain.setParagraph().run();
              else chain.toggleHeading({ level: Number(next.slice(1)) as 1 | 2 | 3 }).run();
            }}
            className="mr-1 h-8 rounded-md border border-gray-700 bg-gray-950 px-1 text-xs text-gray-200"
          >
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          <IconButton title="Bold" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
            <span className="text-sm font-bold">B</span>
          </IconButton>
          <IconButton title="Italic" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <span className="text-sm italic">I</span>
          </IconButton>
          <IconButton title="Underline" active={editor.isActive("underline")} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <span className="text-sm underline">U</span>
          </IconButton>
          <div className="mx-1 flex items-center gap-0.5">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="h-4 w-4 rounded-full border border-gray-600"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <IconButton title="Align left" active={editor.isActive({ textAlign: "left" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M4 6h16v2H4zm0 5h10v2H4zm0 5h16v2H4z" />
            </svg>
          </IconButton>
          <IconButton title="Align center" active={editor.isActive({ textAlign: "center" })} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M4 6h16v2H4zm3 5h10v2H7zm-3 5h16v2H4z" />
            </svg>
          </IconButton>
          <span className="mx-1 h-5 w-px bg-gray-700" />
          <IconButton title="Numbered list" active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M8 6h12v2H8zM8 11h12v2H8zM8 16h12v2H8zM3 6h2v.8H4v.4h1V8H3V7.2h1v-.4H3zm0 5h2v.5H3.2V12H5v1H3v-.5h1.8v-.3H3zm0 5h2v2H3v-.5h1.5v-.3H3.2v-.4H4.5v-.3H3z" />
            </svg>
          </IconButton>
          <IconButton title="Bulleted list" active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M8 6h12v2H8zM8 11h12v2H8zM8 16h12v2H8zM4 7.5A1.5 1.5 0 1 1 4 4.5a1.5 1.5 0 0 1 0 3zm0 5A1.5 1.5 0 1 1 4 9.5a1.5 1.5 0 0 1 0 3zm0 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
            </svg>
          </IconButton>
          <IconButton title="Decrease indent" disabled={disabled} onClick={() => editor.chain().focus().liftListItem("listItem").run()}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 6h12M9 12h12M9 18h12M4 8l-3 4 3 4" />
            </svg>
          </IconButton>
          <IconButton title="Increase indent" disabled={disabled} onClick={() => editor.chain().focus().sinkListItem("listItem").run()}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 6h12M9 12h12M9 18h12M5 8l3 4-3 4" />
            </svg>
          </IconButton>
          <IconButton title="Quote" active={editor.isActive("blockquote")} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <span className="text-base leading-none">”</span>
          </IconButton>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
