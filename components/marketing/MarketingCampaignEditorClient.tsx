"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FieldLabel,
  SettingsButton,
  SettingsPanel,
  StatusPill,
  TextField,
  ToggleRow,
} from "@/components/settings/ui";
import type {
  EmailBlock,
  EmailBlockType,
  MarketingCampaign,
  MarketingEmail,
  MarketingSegment,
  MarketingSettings,
} from "@/lib/marketing/types";

type EventOption = { id: string; title: string; slug: string; date: string; venue: string };

const BLOCK_TYPES: { type: EmailBlockType; label: string }[] = [
  { type: "hero", label: "Hero" },
  { type: "rich_text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "cta", label: "CTA" },
  { type: "event", label: "Event" },
  { type: "divider", label: "Divider" },
  { type: "footer", label: "Footer" },
];

function newBlock(type: EmailBlockType): EmailBlock {
  const id = `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case "hero":
      return { id, type, props: { title: "Crowdsource Choir", subtitle: "", imageUrl: "" } };
    case "rich_text":
      return { id, type, props: { text: "", html: "<p></p>" } };
    case "image":
      return { id, type, props: { imageUrl: "", alt: "", href: "" } };
    case "cta":
      return { id, type, props: { label: "Learn more", href: "https://app.crowdsourcechoir.com" } };
    case "event":
      return { id, type, props: { eventId: "", title: "", ctaText: "Open event" } };
    case "footer":
      return { id, type, props: { companyName: "Crowdsource Choir", physicalAddress: "" } };
    default:
      return { id, type: "divider", props: {} };
  }
}

export default function MarketingCampaignEditorClient({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [email, setEmail] = useState<MarketingEmail | null>(null);
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [testTo, setTestTo] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketing/campaigns/${campaignId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load campaign");
    setCampaign(data.campaign);
    setEmail(data.emails?.[0] ?? null);
    setSegments(data.segments ?? []);
    setSettings(data.settings ?? null);
  }, [campaignId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    fetch("/api/marketing/events", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, [load]);

  const blocks = email?.blocks ?? [];

  function updateBlock(id: string, props: Record<string, unknown>) {
    if (!email) return;
    setEmail({
      ...email,
      blocks: email.blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...props } } : b)),
    });
  }

  async function save() {
    if (!email || !campaign) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaign.name,
          emailId: email.id,
          subject: email.subject,
          previewText: email.previewText,
          fromName: email.fromName,
          fromEmail: email.fromEmail,
          segmentId: email.segmentId,
          blocks: email.blocks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setCampaign(data.campaign);
      setEmail(data.emails?.[0] ?? email);
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "preview" | "test" | "send") {
    if (!email) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await save();
      const res = await fetch(`/api/marketing/emails/${email.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          to: testTo,
          confirmPhrase,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (action === "preview") {
        setPreviewHtml(data.html ?? "");
        setMessage("Preview ready");
      } else if (action === "test") {
        setMessage(`Test sent (${data.providerMessageId})`);
      } else {
        setMessage(`Sent ${data.sent}/${data.queued} (skipped ${data.skipped})`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const segmentLabel = useMemo(() => {
    if (!email?.segmentId) return "No segment";
    return segments.find((s) => s.id === email.segmentId)?.name ?? "Segment";
  }, [email?.segmentId, segments]);

  if (!campaign || !email) {
    return <p className="text-sm text-gray-400">{error || "Loading campaign…"}</p>;
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Campaign"
        title={campaign.name}
        description="Constrained CSC email blocks. Event blocks read Blooms only — they never edit live events."
        actions={
          <>
            <StatusPill tone={email.status === "sent" ? "ok" : "neutral"}>{email.status}</StatusPill>
            <StatusPill tone={settings?.sendsEnabled ? "ok" : "off"}>
              {settings?.sendsEnabled ? "Sends on" : "Sends paused"}
            </StatusPill>
            <SettingsButton href="/admin/marketing/campaigns">Back</SettingsButton>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Campaign name</FieldLabel>
            <TextField value={campaign.name} onChange={(v) => setCampaign({ ...campaign, name: v })} />
          </div>
          <div>
            <FieldLabel>Subject</FieldLabel>
            <TextField value={email.subject} onChange={(v) => setEmail({ ...email, subject: v })} />
          </div>
          <div>
            <FieldLabel>Preview text</FieldLabel>
            <TextField value={email.previewText} onChange={(v) => setEmail({ ...email, previewText: v })} />
          </div>
          <div>
            <FieldLabel>Segment</FieldLabel>
            <select
              value={email.segmentId ?? ""}
              onChange={(e) => setEmail({ ...email, segmentId: e.target.value || null })}
              className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            >
              <option value="">Select segment…</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Sending to: {segmentLabel}</p>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel title="Blocks" description="Add, edit, reorder-simple (top to bottom).">
        <div className="mb-4 flex flex-wrap gap-2">
          {BLOCK_TYPES.map((b) => (
            <SettingsButton
              key={b.type}
              disabled={busy}
              onClick={() => setEmail({ ...email, blocks: [...email.blocks, newBlock(b.type)] })}
            >
              + {b.label}
            </SettingsButton>
          ))}
        </div>

        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-xl border border-[var(--csc-row-divider)] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="csc-eyebrow">{block.type}</p>
                <div className="flex gap-2">
                  <SettingsButton
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...blocks];
                      const tmp = next[index - 1]!;
                      next[index - 1] = next[index]!;
                      next[index] = tmp;
                      setEmail({ ...email, blocks: next });
                    }}
                  >
                    Up
                  </SettingsButton>
                  <SettingsButton
                    disabled={index === blocks.length - 1}
                    onClick={() => {
                      const next = [...blocks];
                      const tmp = next[index + 1]!;
                      next[index + 1] = next[index]!;
                      next[index] = tmp;
                      setEmail({ ...email, blocks: next });
                    }}
                  >
                    Down
                  </SettingsButton>
                  <SettingsButton
                    variant="danger"
                    onClick={() => setEmail({ ...email, blocks: blocks.filter((b) => b.id !== block.id) })}
                  >
                    Remove
                  </SettingsButton>
                </div>
              </div>

              {block.type === "hero" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Title</FieldLabel>
                    <TextField
                      value={String(block.props.title ?? "")}
                      onChange={(v) => updateBlock(block.id, { title: v })}
                    />
                  </div>
                  <div>
                    <FieldLabel>Subtitle</FieldLabel>
                    <TextField
                      value={String(block.props.subtitle ?? "")}
                      onChange={(v) => updateBlock(block.id, { subtitle: v })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Image URL</FieldLabel>
                    <TextField
                      value={String(block.props.imageUrl ?? "")}
                      onChange={(v) => updateBlock(block.id, { imageUrl: v })}
                    />
                  </div>
                </div>
              ) : null}

              {block.type === "rich_text" ? (
                <div>
                  <FieldLabel>Body</FieldLabel>
                  <textarea
                    value={String(block.props.text ?? "")}
                    onChange={(e) => {
                      const text = e.target.value;
                      const html = text
                        .split(/\n\n+/)
                        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
                        .join("");
                      updateBlock(block.id, { text, html });
                    }}
                    rows={5}
                    className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white"
                  />
                </div>
              ) : null}

              {block.type === "image" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FieldLabel>Image URL</FieldLabel>
                    <TextField
                      value={String(block.props.imageUrl ?? "")}
                      onChange={(v) => updateBlock(block.id, { imageUrl: v })}
                    />
                  </div>
                  <div>
                    <FieldLabel>Alt</FieldLabel>
                    <TextField value={String(block.props.alt ?? "")} onChange={(v) => updateBlock(block.id, { alt: v })} />
                  </div>
                  <div>
                    <FieldLabel>Link</FieldLabel>
                    <TextField
                      value={String(block.props.href ?? "")}
                      onChange={(v) => updateBlock(block.id, { href: v })}
                    />
                  </div>
                </div>
              ) : null}

              {block.type === "cta" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Label</FieldLabel>
                    <TextField
                      value={String(block.props.label ?? "")}
                      onChange={(v) => updateBlock(block.id, { label: v })}
                    />
                  </div>
                  <div>
                    <FieldLabel>URL</FieldLabel>
                    <TextField
                      value={String(block.props.href ?? "")}
                      onChange={(v) => updateBlock(block.id, { href: v })}
                    />
                  </div>
                </div>
              ) : null}

              {block.type === "event" ? (
                <div>
                  <FieldLabel hint="Read-only Bloom picker — does not modify the event">Event</FieldLabel>
                  <select
                    value={String(block.props.eventId ?? "")}
                    onChange={(e) => {
                      const eventId = e.target.value;
                      const ev = events.find((x) => x.id === eventId);
                      updateBlock(block.id, {
                        eventId,
                        title: ev?.title ?? "",
                        date: ev?.date ?? "",
                        venue: ev?.venue ?? "",
                        url: ev ? `https://app.crowdsourcechoir.com/e/${ev.slug}` : "",
                      });
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select bloom/event…</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {block.type === "footer" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Company</FieldLabel>
                    <TextField
                      value={String(block.props.companyName ?? "")}
                      onChange={(v) => updateBlock(block.id, { companyName: v })}
                    />
                  </div>
                  <div>
                    <FieldLabel>Address</FieldLabel>
                    <TextField
                      value={String(block.props.physicalAddress ?? "")}
                      onChange={(v) => updateBlock(block.id, { physicalAddress: v })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Preview & send">
        <div className="flex flex-wrap gap-2">
          <SettingsButton variant="primary" disabled={busy} onClick={() => save()}>
            Save draft
          </SettingsButton>
          <SettingsButton disabled={busy} onClick={() => runAction("preview")}>
            Preview
          </SettingsButton>
          <ToggleRow
            label={mobilePreview ? "Mobile preview" : "Desktop preview"}
            checked={mobilePreview}
            onChange={setMobilePreview}
          />
        </div>

        {previewHtml ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--csc-row-divider)] bg-black">
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              className="min-h-[480px] w-full bg-black"
              style={{ maxWidth: mobilePreview ? 390 : "100%", margin: "0 auto", display: "block" }}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Test send to</FieldLabel>
            <TextField value={testTo} onChange={setTestTo} placeholder="you@crowdsourcechoir.com" />
            <div className="mt-2">
              <SettingsButton disabled={busy || !testTo.trim()} onClick={() => runAction("test")}>
                Send test
              </SettingsButton>
            </div>
          </div>
          <div>
            <FieldLabel hint='Type SEND to confirm bulk delivery'>Send to segment</FieldLabel>
            <TextField value={confirmPhrase} onChange={setConfirmPhrase} placeholder="SEND" />
            <div className="mt-2">
              <SettingsButton
                variant="danger"
                disabled={busy || confirmPhrase.trim().toUpperCase() !== "SEND"}
                onClick={() => runAction("send")}
              >
                Send now
              </SettingsButton>
            </div>
          </div>
        </div>

        {email.stats.sent > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill tone="ok">Sent {email.stats.sent}</StatusPill>
            <StatusPill tone="neutral">Delivered {email.stats.delivered}</StatusPill>
            <StatusPill tone="off">Bounced {email.stats.bounced}</StatusPill>
            <StatusPill tone="neutral">Opened {email.stats.opened}</StatusPill>
            <StatusPill tone="neutral">Clicked {email.stats.clicked}</StatusPill>
          </div>
        ) : null}
      </SettingsPanel>

      {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
