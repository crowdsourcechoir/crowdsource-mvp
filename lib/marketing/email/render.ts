import type { EmailBlock, MarketingEmail, MarketingSettings } from "../types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function str(props: Record<string, unknown>, key: string, fallback = ""): string {
  const v = props[key];
  return typeof v === "string" ? v : fallback;
}

export type EventBlockData = {
  title: string;
  description?: string | null;
  heroImage?: string | null;
  venue?: string | null;
  date?: string | null;
  url: string;
  ctaText?: string | null;
};

export type RenderContext = {
  settings: MarketingSettings;
  unsubscribeUrl: string;
  baseUrl: string;
  /** Resolved event payloads keyed by block id */
  eventsByBlockId?: Record<string, EventBlockData>;
};

function renderBlock(block: EmailBlock, ctx: RenderContext): string {
  const p = block.props;
  switch (block.type) {
    case "hero": {
      const title = escapeHtml(str(p, "title", "Crowdsource Choir"));
      const subtitle = escapeHtml(str(p, "subtitle"));
      const imageUrl = str(p, "imageUrl");
      return `
        <tr><td style="padding:0 0 24px 0;">
          ${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px;" />`
              : ""
          }
          <div style="padding-top:${imageUrl ? "20px" : "0"};">
            <div style="font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">${title}</div>
            ${subtitle ? `<div style="margin-top:10px;font-size:15px;line-height:1.5;color:#a1a1aa;">${subtitle}</div>` : ""}
          </div>
        </td></tr>`;
    }
    case "rich_text": {
      // Authoring stores simple HTML from a constrained editor; still escape if plain.
      const html = typeof p.html === "string" ? p.html : escapeHtml(str(p, "text"));
      return `<tr><td style="padding:0 0 20px 0;font-size:15px;line-height:1.6;color:#e4e4e7;">${html}</td></tr>`;
    }
    case "image": {
      const imageUrl = str(p, "imageUrl");
      if (!imageUrl) return "";
      const alt = escapeHtml(str(p, "alt", ""));
      const href = str(p, "href");
      const img = `<img src="${escapeHtml(imageUrl)}" alt="${alt}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px;" />`;
      return `<tr><td style="padding:0 0 20px 0;">${
        href ? `<a href="${escapeHtml(href)}" style="text-decoration:none;">${img}</a>` : img
      }</td></tr>`;
    }
    case "cta": {
      const label = escapeHtml(str(p, "label", "Learn more"));
      const href = escapeHtml(str(p, "href", ctx.baseUrl));
      return `
        <tr><td style="padding:8px 0 24px 0;">
          <a href="${href}" style="display:inline-block;background:#CFFF81;color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;">${label}</a>
        </td></tr>`;
    }
    case "divider":
      return `<tr><td style="padding:8px 0 24px 0;"><div style="height:1px;background:#27272a;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>`;
    case "event": {
      const data = ctx.eventsByBlockId?.[block.id];
      const title = escapeHtml(data?.title ?? str(p, "title", "Event"));
      const description = escapeHtml(data?.description ?? str(p, "description"));
      const venue = escapeHtml(data?.venue ?? str(p, "venue"));
      const date = escapeHtml(data?.date ?? str(p, "date"));
      const url = escapeHtml(data?.url ?? str(p, "url", ctx.baseUrl));
      const cta = escapeHtml(data?.ctaText ?? str(p, "ctaText", "Open event"));
      const hero = data?.heroImage ?? str(p, "heroImage");
      return `
        <tr><td style="padding:0 0 24px 0;">
          <div style="border:1px solid #27272a;border-radius:16px;overflow:hidden;">
            ${
              hero
                ? `<img src="${escapeHtml(hero)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;" />`
                : ""
            }
            <div style="padding:18px;">
              <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#CFFF81;font-weight:700;">Bloom</div>
              <div style="margin-top:8px;font-size:20px;font-weight:700;color:#ffffff;">${title}</div>
              ${date || venue ? `<div style="margin-top:6px;font-size:13px;color:#a1a1aa;">${[date, venue].filter(Boolean).join(" · ")}</div>` : ""}
              ${description ? `<div style="margin-top:10px;font-size:14px;line-height:1.5;color:#d4d4d8;">${description}</div>` : ""}
              <div style="margin-top:16px;">
                <a href="${url}" style="display:inline-block;background:#CFFF81;color:#000000;font-size:13px;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:999px;">${cta}</a>
              </div>
            </div>
          </div>
        </td></tr>`;
    }
    case "footer": {
      const company = escapeHtml(str(p, "companyName", ctx.settings.companyName));
      const address = escapeHtml(str(p, "physicalAddress", ctx.settings.physicalAddress));
      return `
        <tr><td style="padding:28px 0 0 0;border-top:1px solid #27272a;">
          <div style="font-size:12px;line-height:1.6;color:#71717a;">
            <div>${company}</div>
            ${address ? `<div>${address}</div>` : ""}
            <div style="margin-top:10px;">
              <a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:#a3e635;text-decoration:underline;">Unsubscribe</a>
            </div>
          </div>
        </td></tr>`;
    }
    default:
      return "";
  }
}

export function renderMarketingEmail(
  email: MarketingEmail,
  ctx: RenderContext
): { subject: string; html: string; text: string } {
  const blocksHtml = email.blocks.map((b) => renderBlock(b, ctx)).join("\n");
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(email.subject)}</title></head>
<body style="margin:0;padding:0;background:#000000;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(email.previewText)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#000000;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;">
        ${blocksHtml}
      </table>
    </td></tr>
  </table>
</body></html>`;

  const textParts = email.blocks.map((b) => {
    const p = b.props;
    switch (b.type) {
      case "hero":
        return [str(p, "title"), str(p, "subtitle")].filter(Boolean).join("\n");
      case "rich_text":
        return str(p, "text") || String(p.html ?? "").replace(/<[^>]+>/g, " ");
      case "cta":
        return `${str(p, "label")}: ${str(p, "href")}`;
      case "event": {
        const data = ctx.eventsByBlockId?.[b.id];
        return [data?.title ?? str(p, "title"), data?.url ?? str(p, "url")].filter(Boolean).join(" — ");
      }
      case "footer":
        return `Unsubscribe: ${ctx.unsubscribeUrl}`;
      default:
        return "";
    }
  });

  return {
    subject: email.subject || "(no subject)",
    html,
    text: textParts.filter(Boolean).join("\n\n"),
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
