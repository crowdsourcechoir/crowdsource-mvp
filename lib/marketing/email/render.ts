import type { EmailBlock, MarketingEmail, MarketingSettings } from "../types";
import { legacyBlocksToDocument } from "../document/migrate";
import { compileEmailDocument } from "../render/compile";
import type { EventBlockData } from "../render/event-data";
import { personalizeEmail } from "../render/personalize";
import { DEFAULT_EMAIL_TOKENS } from "../render/tokens";

export type { EventBlockData };

export type RenderContext = {
  settings: MarketingSettings;
  unsubscribeUrl: string;
  baseUrl: string;
  eventsByBlockId?: Record<string, EventBlockData>;
};

/** Legacy block preview. Production preview compiles the stored document through MJML. */
export function renderMarketingEmail(
  email: MarketingEmail,
  ctx: RenderContext
): { subject: string; html: string; text: string } {
  const document = legacyBlocksToDocument(email.blocks, "preview", email.subject || "Preview");
  const compiled = compileEmailDocument({
    document,
    tokens: DEFAULT_EMAIL_TOKENS,
    previewText: email.previewText,
    companyName: ctx.settings.companyName,
    physicalAddress: ctx.settings.physicalAddress,
    eventsBySectionId: ctx.eventsByBlockId,
  });
  const personalized = personalizeEmail(
    { html: compiled.html, text: compiled.text },
    {
      first_name: null,
      display_name: null,
      city: null,
      email: null,
      unsubscribe_url: ctx.unsubscribeUrl,
    },
    document.personalization
  );
  return {
    subject: email.subject || "(no subject)",
    html: personalized.html,
    text: personalized.text,
  };
}

export function defaultEmailBlocks(settings: MarketingSettings): EmailBlock[] {
  return [
    {
      id: "blk_hero",
      type: "hero",
      props: { title: "Crowdsource Choir", subtitle: "A note from the living system." },
    },
    {
      id: "blk_body",
      type: "rich_text",
      props: {
        text: "Write your story here.",
        html: "<p>Write your story here.</p>",
      },
    },
    {
      id: "blk_cta",
      type: "cta",
      props: { label: "Explore", href: "https://app.crowdsourcechoir.com" },
    },
    {
      id: "blk_footer",
      type: "footer",
      props: {
        companyName: settings.companyName,
        physicalAddress: settings.physicalAddress,
      },
    },
  ];
}
