"use client";

import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

function isDoc(value: unknown): value is { type: "doc" } {
  return Boolean(value) && typeof value === "object" && (value as { type?: string }).type === "doc";
}

export default function InlineTextEditor({
  value,
  onChange,
  color,
  fontFamily,
  fontSize,
}: {
  value: unknown;
  onChange: (doc: unknown) => void;
  color: string;
  fontFamily: string;
  fontSize: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: isDoc(value) ? value : { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        style: `color:${color};font-family:${fontFamily};font-size:${fontSize}px;line-height:1.5;outline:none;min-height:1.5em;`,
      },
    },
    onUpdate: ({ editor: next }) => onChange(next.getJSON()),
  });

  if (!editor) return null;

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <MarkButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <MarkButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <MarkButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <MarkButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const previous = editor.getAttributes("link").href as string | undefined;
            const href = window.prompt("Link URL", previous ?? "https://");
            if (href === null) return;
            if (!href.trim()) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
          }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function MarkButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
        active ? "border-[var(--csc-accent)] text-[var(--csc-accent)]" : "border-white/20 text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
