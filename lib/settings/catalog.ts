/**
 * OCTO Settings catalog — single source of truth for the Settings hub.
 *
 * Agents: do NOT invent parallel config UIs on Sales / Gardens / etc.
 * Master app controls belong under `/admin/settings/<id>` and must be
 * registered here. See `.cursor/rules/admin-settings-design-system.mdc`
 * and `docs/octo-settings-contract.md`.
 */

export type SettingsCardStatus =
  | "live"
  | "coming_next"
  | "legacy_deeplink"
  | "policy";

export type SettingsCard = {
  /** Stable id — also used as `/admin/settings/<id>` when implemented */
  id: string;
  domain: string;
  title: string;
  description: string;
  /** Hub link target */
  href: string;
  /** Short hub CTA label (arrow appended in UI) */
  statusLabel: string;
  status: SettingsCardStatus;
  /**
   * Master controls this card owns. New implementations must cover these
   * (or update this list deliberately) — do not invent a second home.
   */
  controls: string[];
};

export type SettingsGroup = {
  id: string;
  heading: string;
  blurb: string;
  cards: SettingsCard[];
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "account",
    heading: "Account",
    blurb: "Who you are in the system and how you sign in.",
    cards: [
      {
        id: "profile",
        domain: "Identity",
        title: "Profile",
        description: "Name, email, outreach identity",
        href: "/admin/settings",
        statusLabel: "Coming next",
        status: "coming_next",
        controls: [
          "Display name (outreach sender / facilitator label)",
          "Contact email",
          "Booking / book URL override",
        ],
      },
      {
        id: "access",
        domain: "Security",
        title: "Sign-in & access",
        description: "Password, magic link, sessions",
        href: "/admin/settings",
        statusLabel: "Coming next",
        status: "coming_next",
        controls: [
          "Admin gate status",
          "Change password",
          "Sign out / session readout",
        ],
      },
    ],
  },
  {
    id: "integrations",
    heading: "Integrations",
    blurb: "External services that power enrichment, outreach, and generation across OCTO.",
    cards: [
      {
        id: "hunter",
        domain: "Sales",
        title: "Hunter enrichment",
        description: "Key, credits, find/verify",
        href: "/admin/settings/hunter",
        statusLabel: "Manage",
        status: "live",
        controls: [
          "Key present / ready status",
          "Credits: plan, used, remaining, renew/reset date",
          "Cost model readout + period usage",
          "Find / verify policy (caps)",
          "Refresh credits; optional test find",
        ],
      },
      {
        id: "gmail",
        domain: "Sales",
        title: "Google connections",
        description: "Gmail, Calendar, Slides",
        href: "/admin/settings/gmail",
        statusLabel: "Manage",
        status: "live",
        controls: [
          "Connect / Disconnect Google account",
          "Connected account email + granted scopes (Gmail + Calendar + Slides)",
          "Pause / Resume Gmail sending",
          "Reply sync now + nudge policy",
          "Calendar sync window + Sync calendar now",
          "Slides reconnect + pitch template file id",
          "Link to Sales calendar view",
        ],
      },
      {
        id: "digest",
        domain: "Sales",
        title: "Daily digest",
        description: "Daily morning leads (target 10)",
        href: "/admin/settings/digest",
        statusLabel: "Manage",
        status: "live",
        controls: [
          "On / Off (stored override, gates cron + manual sends)",
          "Recipient override + from readout",
          "Min score + target lead count",
          "Category filter (orgs only; default conferences)",
          "Cron schedule readout",
          "Recent runs; Send now / Force send",
        ],
      },
      {
        id: "marketing",
        domain: "Marketing",
        title: "Marketing",
        description: "Resend, sender, ingest secret",
        href: "/admin/settings/marketing",
        statusLabel: "Manage",
        status: "live",
        controls: [
          "Enable / pause marketing sends",
          "From name + verified from email + reply-to",
          "Company + physical address for footer",
          "Acquisition ingest secret (Squarespace / Facebook)",
          "Resend webhook endpoint readout",
        ],
      },
    ],
  },
  {
    id: "living-system",
    heading: "Living system defaults",
    blurb: "Shared defaults that keep Gardens, Blooms, Roots, Live, and Composer coherent.",
    cards: [
      {
        id: "gardens",
        domain: "Gardens",
        title: "World & brand defaults",
        description: "Status, zones, presentation",
        href: "/admin/gardens",
        statusLabel: "Open Gardens",
        status: "legacy_deeplink",
        controls: [
          "Default status / kind for new gardens",
          "Default brand kit (primary, accent, title, animation)",
          "Default mutation / growth landmarks",
        ],
      },
      {
        id: "blooms",
        domain: "Blooms",
        title: "Journey & consent",
        description: "Consent, name step, channels",
        href: "/admin/events",
        statusLabel: "Open Blooms",
        status: "legacy_deeplink",
        controls: [
          "Consent on + master consent copy",
          "Collect-name on + name prompt",
          "Opening headline / CTA / final message defaults",
          "Record caps (sound / video seconds)",
        ],
      },
      {
        id: "live",
        domain: "Live",
        title: "Runtime defaults",
        description: "Modes, signals, facilitation",
        href: "/admin/live",
        statusLabel: "Open Live",
        status: "legacy_deeplink",
        controls: [
          "Default launch mode (game / fishbowl / signal)",
          "Default signal block / layer template",
        ],
      },
      {
        id: "composer",
        domain: "Composer",
        title: "Formation preferences",
        description: "Briefs, pads, entry points",
        href: "/admin/composer",
        statusLabel: "Open Composer",
        status: "legacy_deeplink",
        controls: [
          "Default entry (library vs blank)",
          "Preferred garden / bloom",
          "Brief defaults (sections / tone) when productized",
        ],
      },
    ],
  },
  {
    id: "root-system",
    heading: "Root system",
    blurb:
      "The participation methodology behind Blooms — moved out of the main nav so it lives with the system controls.",
    cards: [
      {
        id: "roots",
        domain: "Roots",
        title: "Participation loop",
        description: "Invitation → response loop",
        href: "/admin/roots",
        statusLabel: "Open Roots",
        status: "legacy_deeplink",
        controls: [
          "Loop principles reference",
          "Roots-facing tools (conductor, brief, resonance, live)",
          "Presence / recognition thresholds (code-backed only)",
        ],
      },
      {
        id: "resonance",
        domain: "Roots",
        title: "Resonance signal",
        description: "Real-time listening prototype",
        href: "/admin/resonance",
        statusLabel: "Open resonance",
        status: "legacy_deeplink",
        controls: ["Signal prototype entry point"],
      },
    ],
  },
  {
    id: "workspace",
    heading: "Workspace",
    blurb: "Operator-facing preferences for this Crowdsource workspace.",
    cards: [
      {
        id: "design-system",
        domain: "Appearance",
        title: "Design system",
        description: "Accent, rows, buttons, links",
        href: "/admin/settings/design-system",
        statusLabel: "Edit tokens",
        status: "live",
        controls: [
          "Accent, shell background, row divider",
          "Row padding, outline width, circle button size",
          "Live preview + reset defaults",
        ],
      },
      {
        id: "admin-chrome",
        domain: "Appearance",
        title: "Admin chrome",
        description: "Sidebar and shell prefs",
        href: "/admin/settings/design-system",
        statusLabel: "Active",
        status: "live",
        controls: [
          "Sidebar collapsed by default (per browser)",
          "Reset chrome prefs",
          "Shell colors via Design system (do not fork)",
        ],
      },
      {
        id: "danger",
        domain: "Safety",
        title: "Danger zone",
        description: "Confirm-gated destructive actions",
        href: "/admin/settings",
        statusLabel: "Policy",
        status: "policy",
        controls: [
          "Emergency pause Gmail sending",
          "Disconnect Gmail",
          "Wipe Bloom submissions (confirm-gated)",
          "Delete garden / Bloom (confirm-gated)",
          "Clear local design-system / chrome prefs",
        ],
      },
    ],
  },
];

export function getSettingsCard(id: string): SettingsCard | undefined {
  for (const group of SETTINGS_GROUPS) {
    const card = group.cards.find((c) => c.id === id);
    if (card) return card;
  }
  return undefined;
}
