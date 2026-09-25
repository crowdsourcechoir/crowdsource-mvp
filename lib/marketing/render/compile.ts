import mjml2html from "mjml";
import type { EmailDocument } from "../document/types";
import { escapeHtml } from "./html";
import { renderSection } from "./blocks/render-section";
import type { EventBlockData } from "./event-data";
import type { EmailLink } from "./section";
import type { EmailDesignTokens } from "./tokens";

export const MJML_RENDERER_VERSION = "mjml@4.18.0";

type MjmlError = { formattedMessage?: string; message?: string };
type MjmlCompile = (input: string, options: { validationLevel: "soft" }) => { html: string; errors: MjmlError[] };

const compileMjml = mjml2html as unknown as MjmlCompile;

export type CompiledEmail = {
  ok: boolean;
  html: string;
  text: string;
  mjml: string;
  errors: string[];
  warnings: string[];
  links: EmailLink[];
};

export function compileEmailDocument(input: {
  document: EmailDocument;
  tokens: EmailDesignTokens;
  previewText?: string;
  companyName: string;
  physicalAddress: string;
  eventsBySectionId?: Record<string, EventBlockData | null>;
}): CompiledEmail {
  const errors: string[] = [];
  const warnings: string[] = [];
  const links: EmailLink[] = [];
  const textParts: string[] = [];
  const sections: string[] = [];
  const footer = input.document.sections.filter((section) => section.type === "footer");
  if (footer.length === 0) errors.push("document needs a footer");

  for (const section of input.document.sections) {
    const rendered = renderSection(section, {
      tokens: input.tokens,
      companyName: input.companyName,
      physicalAddress: input.physicalAddress,
      event: input.eventsBySectionId?.[section.id] ?? null,
    });
    if ("error" in rendered) {
      errors.push(rendered.error);
      continue;
    }
    sections.push(rendered.mjml);
    if (rendered.text) textParts.push(rendered.text);
    links.push(...rendered.links);
    warnings.push(...rendered.warnings);
  }

  const preview = escapeHtml(input.previewText ?? "");
  const mjml = `<mjml>
  <mj-head>
    <mj-preview>${preview}</mj-preview>
    <mj-attributes>
      <mj-all font-family="${escapeHtml(input.tokens.fonts.body)}" />
    </mj-attributes>
    <mj-style>
      @media only screen and (max-width: 480px) {
        .hide-on-mobile { display: none !important; max-height: 0 !important; overflow: hidden !important; }
      }
    </mj-style>
  </mj-head>
  <mj-body background-color="${escapeHtml(input.tokens.colors.canvas)}" width="${input.tokens.emailWidth}px">
    ${sections.join("\n")}
  </mj-body>
</mjml>`;

  if (errors.length) {
    return { ok: false, html: "", text: textParts.join("\n\n"), mjml, errors, warnings, links };
  }

  let html = "";
  try {
    const result = compileMjml(mjml, { validationLevel: "soft" });
    html = result.html;
    for (const issue of result.errors ?? []) {
      const message = issue.formattedMessage || issue.message;
      if (message) errors.push(message);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "MJML compile failed");
  }

  return {
    ok: errors.length === 0 && Boolean(html),
    html,
    text: textParts.join("\n\n"),
    mjml,
    errors,
    warnings,
    links,
  };
}
