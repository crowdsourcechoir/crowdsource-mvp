// node --experimental-strip-types --import ./scripts/marketing/register-strip-types.mjs lib/marketing/render/render.test.ts
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EmailDocument, EmailSection, SectionType } from "../document/types";
import { compileEmailDocument } from "./compile";
import { personalizeEmail } from "./personalize";
import { DEFAULT_EMAIL_TOKENS, resolveEmailTokens } from "./tokens";

const snapshotDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "snapshots");
const update = process.env.UPDATE_SNAPSHOTS === "1";

function section(type: SectionType, props: Record<string, unknown>, patch: Partial<EmailSection> = {}): EmailSection {
  return {
    id: type,
    type,
    spacing: "medium",
    background: "canvas",
    align: "left",
    hideOnMobile: false,
    props,
    ...patch,
  };
}

const footer = section("footer", { companyName: "CSC", physicalAddress: "Seattle", showUnsubscribe: true });

function document(sections: EmailSection[], personalization?: EmailDocument["personalization"]): EmailDocument {
  return {
    schemaVersion: 1,
    designSystemId: "design",
    meta: { internalTitle: "Fixture" },
    personalization: personalization ?? { missingTokenBehavior: "fallback", fallbacks: { first_name: "friend" } },
    sections,
  };
}

function compile(sections: EmailSection[]) {
  return compileEmailDocument({
    document: document(sections),
    tokens: DEFAULT_EMAIL_TOKENS,
    previewText: "Preview <text>",
    companyName: "CSC",
    physicalAddress: "Seattle",
  });
}

function expectSnapshot(name: string, html: string) {
  mkdirSync(snapshotDir, { recursive: true });
  const file = path.join(snapshotDir, `${name}.html`);
  if (update) {
    writeFileSync(file, html);
    return;
  }
  const expected = readFileSync(file, "utf8");
  assert.equal(html, expected);
}

const fixtures: Array<{ name: string; sections: EmailSection[]; assert: (html: string) => void }> = [
  {
    name: "hero",
    sections: [
      section("hero", {
        eyebrow: "Note",
        title: "Hello <there>",
        subtitle: "Hi {{first_name}}",
        image: { assetId: null, url: "https://cdn.example/a.jpg", alt: "Cover & <art>", ratio: "landscape" },
        ctaLabel: "Go",
        ctaHref: "https://example.com/go",
      }),
    ],
    assert: (html) => {
      assert.match(html, /alt="Cover &amp; &lt;art&gt;"/);
      assert.match(html, /Hello &lt;there&gt;/);
      assert.match(html, /Bebas Neue/);
      assert.equal(html.includes("<script"), false);
    },
  },
  {
    name: "full-bleed-image",
    sections: [
      section("full_bleed_image", {
        image: { assetId: null, url: "https://cdn.example/b.jpg", alt: "Wide", ratio: "landscape" },
        href: "https://example.com/img",
      }),
    ],
    assert: (html) => {
      assert.match(html, /alt="Wide"/);
      assert.match(html, /https:\/\/example.com\/img/);
    },
  },
  {
    name: "editorial-text",
    sections: [
      section("editorial_text", {
        heading: "Story",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Line <one>", marks: [{ type: "bold" }] },
                { type: "personalization", attrs: { token: "first_name" } },
              ],
            },
          ],
        },
      }),
    ],
    assert: (html) => {
      assert.match(html, /<strong>Line &lt;one&gt;<\/strong>/);
      assert.match(html, /\{\{first_name\}\}/);
      assert.equal(html.includes("<script"), false);
    },
  },
  {
    name: "image-story",
    sections: [
      section("image_story", {
        image: { assetId: null, url: "https://cdn.example/c.jpg", alt: "Side", ratio: "portrait" },
        imagePosition: "right",
        heading: "Beside",
        text: "Copy",
        ctaLabel: "Open",
        ctaHref: "https://example.com/story",
      }),
    ],
    assert: (html) => {
      assert.match(html, /alt="Side"/);
      assert.match(html, /https:\/\/example.com\/story/);
    },
  },
  {
    name: "cta",
    sections: [
      section("cta", {
        label: "Go",
        href: 'https://example.com/?q="><script>alert(1)</script>',
        style: "solid",
      }),
    ],
    assert: (html) => {
      assert.equal(html.includes("<script"), false);
      assert.match(html, /&lt;script&gt;/);
    },
  },
  {
    name: "divider",
    sections: [section("divider", {})],
    assert: (html) => {
      assert.match(html, /mj-divider|border-top|height:1px|line-height/i);
    },
  },
  {
    name: "spacer",
    sections: [section("spacer", {}, { spacing: "large" })],
    assert: (html) => {
      assert.match(html, /48px/);
    },
  },
  {
    name: "event",
    sections: [
      section("event", {
        eventId: "evt_1",
        title: "Bloom",
        description: "Night",
        venue: "Hall",
        date: "Friday",
        href: "https://example.com/e/bloom",
        ctaLabel: "Open",
      }),
    ],
    assert: (html) => {
      assert.match(html, /Bloom/);
      assert.match(html, /https:\/\/example.com\/e\/bloom/);
    },
  },
  {
    name: "large-statement",
    sections: [section("large_statement", { eyebrow: "Note", text: "Sing it <loud>" })],
    assert: (html) => {
      assert.match(html, /Sing it &lt;loud&gt;/);
      assert.equal(html.includes("<script"), false);
    },
  },
  {
    name: "pull-quote",
    sections: [section("pull_quote", { quote: "A line", attribution: "Ada" })],
    assert: (html) => {
      assert.match(html, /A line/);
      assert.match(html, /Ada/);
    },
  },
  {
    name: "two-column",
    sections: [section("two_column", { leftHeading: "Left", leftText: "One", rightHeading: "Right", rightText: "Two" })],
    assert: (html) => {
      assert.match(html, /Left/);
      assert.match(html, /Right/);
    },
  },
  {
    name: "gallery",
    sections: [
      section("gallery", {
        images: [{ assetId: null, url: "https://cdn.example/a.jpg", alt: "One", ratio: "square" }],
      }),
    ],
    assert: (html) => {
      assert.match(html, /alt="One"/);
    },
  },
  {
    name: "song-garden-invitation",
    sections: [
      section("song_garden_invitation", {
        heading: "Garden",
        text: "Come sing",
        ctaLabel: "Open",
        ctaHref: "https://example.com/garden",
      }),
    ],
    assert: (html) => {
      assert.match(html, /https:\/\/example.com\/garden/);
    },
  },
  {
    name: "artist-feature",
    sections: [section("artist_feature", { name: "Ada", role: "Voice", bio: "Sings", href: "https://example.com/ada" })],
    assert: (html) => {
      assert.match(html, /Ada/);
      assert.match(html, /https:\/\/example.com\/ada/);
    },
  },
  {
    name: "footer",
    sections: [],
    assert: (html) => {
      assert.match(html, /\{\{unsubscribe_url\}\}/);
      assert.match(html, /Unsubscribe/);
      assert.match(html, /Seattle/);
      assert.equal(html.includes("<script"), false);
    },
  },
];

for (const fixture of fixtures) {
  const result = compile([...fixture.sections, footer]);
  assert.equal(result.ok, true, `${fixture.name}: ${result.errors.join("; ")}`);
  fixture.assert(result.html);
  assert.match(result.html, /src="https:\/\/app\.crowdsourcechoir\.com\/logo\.png"/);
  assert.match(result.html, /alt="Crowdsource Choir"/);
  assert.match(result.html, /Space Mono/);
  assert.equal(result.links.some((link) => link.url === "{{unsubscribe_url}}"), true);
  expectSnapshot(fixture.name, result.html);
}

const missingFooter = compileEmailDocument({
  document: document([section("hero", { title: "Hi" })]),
  tokens: DEFAULT_EMAIL_TOKENS,
  companyName: "CSC",
  physicalAddress: "Seattle",
});
assert.equal(missingFooter.ok, false);
assert.match(missingFooter.errors.join(" "), /footer/);

const hiddenUnsubscribe = compile([section("footer", { companyName: "CSC", physicalAddress: "Seattle", showUnsubscribe: false })]);
assert.equal(hiddenUnsubscribe.ok, false);
assert.match(hiddenUnsubscribe.errors.join(" "), /unsubscribe/);

const statement = compile([section("large_statement", { text: "No" }), footer]);
assert.equal(statement.ok, true, statement.errors.join("; "));
assert.match(statement.html, /No/);

const seeded = compileEmailDocument({
  document: document([
    section("editorial_text", { text: "Hello {{first_name}}" }),
    footer,
  ]),
  tokens: resolveEmailTokens({
    schemaVersion: 1,
    emailWidth: 600,
    contentWidth: 560,
    fonts: DEFAULT_EMAIL_TOKENS.fonts,
    colors: DEFAULT_EMAIL_TOKENS.colors,
    spacing: DEFAULT_EMAIL_TOKENS.spacing,
  }),
  companyName: "CSC",
  physicalAddress: "Seattle",
});
assert.equal(seeded.ok, true, seeded.errors.join("; "));

const personalized = personalizeEmail(
  { html: "Hi {{first_name}} <{{display_name}}>", text: "Hi {{first_name}}" },
  { first_name: "Ada <script>", display_name: null, city: null, email: null, unsubscribe_url: "https://example.com/u?e=1" },
  { missingTokenBehavior: "fallback", fallbacks: { first_name: "friend", display_name: "neighbor" } }
);
assert.equal(personalized.html.includes("<script"), false);
assert.match(personalized.html, /Ada &lt;script&gt;/);
assert.match(personalized.html, /neighbor/);

const blank = personalizeEmail(
  { html: "{{first_name}}", text: "{{first_name}}" },
  { first_name: " ", display_name: null, city: null, email: null, unsubscribe_url: "https://example.com/u" },
  { missingTokenBehavior: "blank", fallbacks: { first_name: "friend" } }
);
assert.equal(blank.html, "");
assert.equal(blank.text, "");

const upgraded = resolveEmailTokens({
  fonts: {
    heading: "Georgia, 'Times New Roman', Times, serif",
    body: "Georgia, 'Times New Roman', Times, serif",
    ui: "Arial, Helvetica, sans-serif",
  },
  colors: { canvas: "#111111" },
  type: { title: { size: 12, lineHeight: 1, weight: 700 } },
  button: { paddingX: 4, paddingY: 4, fontSize: 20 },
});
assert.match(upgraded.fonts.heading, /Bebas Neue/);
assert.match(upgraded.fonts.body, /Space Mono/);
assert.equal(upgraded.colors.canvas, "#111111");
assert.equal(upgraded.type.title.size, DEFAULT_EMAIL_TOKENS.type.title.size);
assert.equal(upgraded.button.fontSize, DEFAULT_EMAIL_TOKENS.button.fontSize);

const customFonts = resolveEmailTokens({
  fonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif", ui: "Inter, sans-serif" },
  type: { title: { size: 18, lineHeight: 1.1, weight: 600 } },
});
assert.equal(customFonts.fonts.heading, "Inter, sans-serif");
assert.equal(customFonts.type.title.size, 18);

console.log("marketing render tests ok");
