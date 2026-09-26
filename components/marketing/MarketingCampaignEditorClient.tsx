"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldLabel, SettingsButton, SettingsPanel, StatusPill, TextField, ToggleRow } from "@/components/settings/ui";
import EmailEditor from "@/components/marketing/editor/EmailEditor";
import type { EmailSection } from "@/lib/marketing/document/types";
import { DEFAULT_EMAIL_TOKENS, type EmailDesignTokens } from "@/lib/marketing/render/tokens";
import type { MarketingCampaign, MarketingEmail, MarketingSegment, MarketingSettings } from "@/lib/marketing/types";

type EventOption = { id: string; title: string; slug: string; date: string; venue: string };
type TemplateOption = { id: string; name: string };

function withEditableBody(sections: EmailSection[]): EmailSection[] {
  return sections.map((section) => {
    if (section.type !== "editorial_text" || section.props.body) return section;
    const text = typeof section.props.text === "string" ? section.props.text : "";
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    return {
      ...section,
      props: {
        ...section.props,
        text: "",
        body: {
          type: "doc",
          content: (paragraphs.length ? paragraphs : [""]).map((paragraph) => ({
            type: "paragraph",
            content: paragraph ? [{ type: "text", text: paragraph }] : [],
          })),
        },
      },
    };
  });
}

export default function MarketingCampaignEditorClient({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [designSystemId, setDesignSystemId] = useState<string>("");
  const [email, setEmail] = useState<MarketingEmail | null>(null);
  const [sections, setSections] = useState<EmailSection[]>([]);
  const [tokens, setTokens] = useState<EmailDesignTokens>(DEFAULT_EMAIL_TOKENS);
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
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
    setDocumentId(typeof data.documentId === "string" ? data.documentId : null);
    setDesignSystemId(typeof data.document?.designSystemId === "string" ? data.document.designSystemId : "");
    setEmail(data.emails?.[0] ?? null);
    setSections(withEditableBody(Array.isArray(data.document?.sections) ? data.document.sections : []));
    setSegments(data.segments ?? []);
    setSettings(data.settings ?? null);
  }, [campaignId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    fetch("/api/marketing/events", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
    fetch("/api/marketing/design", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.tokens) setTokens(data.tokens);
      })
      .catch(() => setTokens(DEFAULT_EMAIL_TOKENS));
    fetch("/api/marketing/templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setTemplates([]));
  }, [load]);

  useEffect(() => {
    if (!documentId) return;
    const timer = window.setTimeout(() => {
      fetch(`/api/marketing/documents/${documentId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, previewText: email?.previewText ?? "" }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.html === "string") setPreviewHtml(data.html);
        })
        .catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [documentId, sections, email?.previewText]);

  async function save(): Promise<string | null> {
    if (!email || !campaign) return null;
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
          sections,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const nextDocumentId = typeof data.documentId === "string" ? data.documentId : documentId;
      setCampaign(data.campaign);
      setDocumentId(nextDocumentId);
      setEmail(data.emails?.[0] ?? email);
      if (Array.isArray(data.document?.sections)) setSections(withEditableBody(data.document.sections));
      setMessage("Saved");
      return nextDocumentId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "test" | "send") {
    if (!email) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const savedDocumentId = await save();
      if (!savedDocumentId) return;
      const res = await fetch(`/api/marketing/emails/${email.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, to: testTo, confirmPhrase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (action === "test") setMessage(`Test sent (${data.providerMessageId})`);
      else {
        setMessage(`Sent ${data.sent}/${data.queued} (skipped ${data.skipped})`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!templateName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), sections, designSystemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save template");
      setTemplates((current) => [data.template, ...current]);
      setTemplateName("");
      setMessage("Template saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setBusy(false);
    }
  }

  async function applyTemplate() {
    if (!templateId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", templateId, campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not apply template");
      setSections(withEditableBody(data.document.sections ?? []));
      setMessage("Template applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply template");
    } finally {
      setBusy(false);
    }
  }

  const segmentLabel = useMemo(() => {
    if (!email?.segmentId) return "No segment";
    return segments.find((segment) => segment.id === email.segmentId)?.name ?? "Segment";
  }, [email?.segmentId, segments]);

  if (!campaign || !email) {
    return <p className="text-sm text-gray-400">{error || "Loading campaign…"}</p>;
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Campaign"
        title={campaign.name}
        description="The column is the email. The iframe underneath is the message that will send."
        actions={
          <>
            <StatusPill tone={email.status === "sent" ? "ok" : "neutral"}>{email.status}</StatusPill>
            <StatusPill tone={settings?.sendsEnabled ? "ok" : "off"}>{settings?.sendsEnabled ? "Sends on" : "Sends paused"}</StatusPill>
            <SettingsButton href="/admin/marketing/campaigns">Back</SettingsButton>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Campaign name</FieldLabel>
            <TextField value={campaign.name} onChange={(value) => setCampaign({ ...campaign, name: value })} />
          </div>
          <div>
            <FieldLabel>Subject</FieldLabel>
            <TextField value={email.subject} onChange={(value) => setEmail({ ...email, subject: value })} />
          </div>
          <div>
            <FieldLabel>Preview text</FieldLabel>
            <TextField value={email.previewText} onChange={(value) => setEmail({ ...email, previewText: value })} />
          </div>
          <div>
            <FieldLabel>Segment</FieldLabel>
            <select
              value={email.segmentId ?? ""}
              onChange={(event) => setEmail({ ...email, segmentId: event.target.value || null })}
              className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            >
              <option value="">Select segment…</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Sending to: {segmentLabel}</p>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel title="Email" description="Drag a section type onto the email. Drag a section by its name to move it. Click a section to edit it.">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <FieldLabel>Template</FieldLabel>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            >
              <option value="">Choose a template…</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <SettingsButton disabled={busy || !templateId} onClick={() => applyTemplate()}>
            Apply
          </SettingsButton>
          <div className="min-w-[12rem] flex-1">
            <FieldLabel>Save this email as a template</FieldLabel>
            <TextField value={templateName} onChange={setTemplateName} placeholder="Template name" />
          </div>
          <SettingsButton disabled={busy || !templateName.trim()} onClick={() => saveTemplate()}>
            Save template
          </SettingsButton>
        </div>
        <EmailEditor sections={sections} tokens={tokens} events={events} busy={busy} onChange={setSections} />
      </SettingsPanel>

      <SettingsPanel title="Sendable preview">
        <div className="flex flex-wrap gap-2">
          <SettingsButton variant="primary" disabled={busy} onClick={() => save()}>
            Save draft
          </SettingsButton>
          <ToggleRow label={mobilePreview ? "Mobile preview" : "Desktop preview"} checked={mobilePreview} onChange={setMobilePreview} />
        </div>
        {previewHtml ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--csc-row-divider)] bg-black">
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              className="min-h-[480px] w-full bg-black"
              sandbox=""
              style={{ maxWidth: mobilePreview ? 375 : 600, margin: "0 auto", display: "block" }}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-400">The compiled email appears here as you edit.</p>
        )}
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
            <FieldLabel hint="Type SEND to confirm bulk delivery">Send to segment</FieldLabel>
            <TextField value={confirmPhrase} onChange={setConfirmPhrase} placeholder="SEND" />
            <div className="mt-2">
              <SettingsButton variant="danger" disabled={busy || confirmPhrase.trim().toUpperCase() !== "SEND"} onClick={() => runAction("send")}>
                Send now
              </SettingsButton>
            </div>
          </div>
        </div>
      </SettingsPanel>

      {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
