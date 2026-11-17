"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsButton } from "@/components/settings/ui";

type SpaceRole = "deck" | "proposal" | "show" | "notes";

type Row = {
  role: SpaceRole;
  label: string;
  placementId: string | null;
  title: string;
  body: string;
  pathSlug: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  published: boolean;
  pitchId: string | null;
  pitchName: string | null;
  pitchLive: boolean | null;
  href: string | null;
};

type Deal = {
  id: string;
  name: string;
  slug: string;
  current: boolean;
  salesOpportunityId: string | null;
  opportunityTitle: string | null;
  rows: Row[];
};

type Account = {
  organizationId: string;
  organizationName: string | null;
  slug: string;
  protected: boolean;
  deals: Deal[];
};

type PitchChoice = { id: string; name: string; live: boolean; organizationId: string | null };
type OrgHit = { id: string; name: string };

const fieldClass =
  "border border-white/15 bg-black px-2 py-1 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none";

function suggestSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function copyText(value: string): Promise<boolean> {
  const url = new URL(value, window.location.origin).toString();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* fall through */
  }
  const area = document.createElement("textarea");
  area.value = url;
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

export default function ClientSpaces({
  organizationId,
  organizationName,
  salesOpportunityId,
  opportunityTitle,
}: {
  organizationId?: string;
  organizationName?: string;
  salesOpportunityId?: string;
  opportunityTitle?: string;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [pitches, setPitches] = useState<PitchChoice[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/spaces", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load workspaces");
    setAccounts(data.accounts ?? []);
    setPitches(data.pitches ?? []);
    if (data.error) setStatus(data.error);
  }, []);

  useEffect(() => {
    reload().catch((err) => setStatus(err instanceof Error ? err.message : "Could not load workspaces"));
  }, [reload]);

  async function send(url: string, method: string, payload: unknown) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setAccounts(data.accounts ?? []);
      setPitches(data.pitches ?? []);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () => (organizationId ? (accounts ?? []).filter((account) => account.organizationId === organizationId) : accounts ?? []),
    [accounts, organizationId]
  );
  const current = organizationId ? visible[0] ?? null : null;

  return (
    <section>
      <p className="csc-eyebrow">Workspaces</p>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        One address per client. Each deal holds a deck, a proposal, the show, and notes.
      </p>
      {status ? <p className="mt-3 text-sm text-[var(--csc-accent)]">{status}</p> : null}
      {accounts === null ? <p className="mt-4 text-sm text-white/50">Loading…</p> : null}

      {accounts && !current && (organizationId || visible.length === 0 || !organizationId) ? (
        <StartWorkspace
          busy={busy}
          organizationId={organizationId}
          organizationName={organizationName}
          salesOpportunityId={salesOpportunityId}
          opportunityTitle={opportunityTitle}
          showOrgSearch={!organizationId}
          onCreate={(payload) => send("/api/spaces", "POST", payload)}
        />
      ) : null}

      <div className="csc-list mt-4">
        {visible.map((account) => (
          <AccountBlock
            key={account.organizationId}
            account={account}
            pitches={pitches}
            busy={busy}
            copied={copied}
            focusOpportunityId={salesOpportunityId}
            opportunityTitle={opportunityTitle}
            onCopy={async (href) => {
              const ok = await copyText(href);
              if (!ok) {
                setStatus("Could not copy that link.");
                return;
              }
              setCopied(href);
              window.setTimeout(() => setCopied((item) => (item === href ? null : item)), 1600);
            }}
            onAccount={(payload) => send(`/api/spaces/accounts/${account.organizationId}`, "PATCH", payload)}
            onDeal={(payload) => send("/api/spaces/deals", "POST", payload)}
            onDealPatch={(dealId, payload) => send(`/api/spaces/deals/${dealId}`, "PATCH", payload)}
            onRow={(dealId, payload) => send(`/api/spaces/deals/${dealId}/rows`, "POST", payload)}
          />
        ))}
      </div>
    </section>
  );
}

function StartWorkspace({
  busy,
  organizationId,
  organizationName,
  salesOpportunityId,
  opportunityTitle,
  showOrgSearch,
  onCreate,
}: {
  busy: boolean;
  organizationId?: string;
  organizationName?: string;
  salesOpportunityId?: string;
  opportunityTitle?: string;
  showOrgSearch: boolean;
  onCreate: (payload: Record<string, string | null>) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<OrgHit[]>([]);
  const [orgId, setOrgId] = useState(organizationId ?? "");
  const [orgName, setOrgName] = useState(organizationName ?? "");
  const [slug, setSlug] = useState(organizationName ? suggestSlug(organizationName) : "");
  const [password, setPassword] = useState("");
  const [dealName, setDealName] = useState(opportunityTitle || organizationName || "Current");
  const [dealSlug, setDealSlug] = useState(suggestSlug(opportunityTitle || "current") || "current");

  useEffect(() => {
    if (!showOrgSearch) return;
    const text = query.trim();
    if (text.length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      fetch(`/api/sales/organizations?search=${encodeURIComponent(text)}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          const rows = Array.isArray(data.organizations) ? data.organizations : [];
          setHits(rows.slice(0, 8).map((org: { id?: string; name?: string }) => ({ id: String(org.id ?? ""), name: String(org.name ?? "") })));
        })
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, showOrgSearch]);

  return (
    <form
      className="mt-4 border-b border-[var(--csc-row-divider)] pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({
          organizationId: orgId,
          slug,
          password,
          dealName,
          dealSlug,
          salesOpportunityId: salesOpportunityId ?? null,
        });
      }}
    >
      <p className="text-sm text-white">Start a client address</p>
      {showOrgSearch ? (
        <label className="mt-3 block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Organization</span>
          <input
            value={query}
            aria-label="Find an organization"
            placeholder={orgName || "Search organizations"}
            onChange={(event) => setQuery(event.target.value)}
            className={`mt-1 w-full ${fieldClass} px-3 py-2`}
          />
          {hits.length > 0 ? (
            <div className="csc-list mt-2">
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="csc-list-row w-full text-left text-sm"
                  onClick={() => {
                    setOrgId(hit.id);
                    setOrgName(hit.name);
                    setSlug(suggestSlug(hit.name));
                    setQuery("");
                    setHits([]);
                    if (!opportunityTitle) {
                      setDealName(hit.name);
                      setDealSlug("current");
                    }
                  }}
                >
                  {hit.name}
                </button>
              ))}
            </div>
          ) : null}
          {orgName ? <p className="mt-2 text-sm text-white/70">{orgName}</p> : null}
        </label>
      ) : (
        <p className="mt-2 text-sm text-white/70">{orgName}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Address</span>
          <input value={slug} aria-label="Client address" onChange={(event) => setSlug(event.target.value)} onBlur={(event) => setSlug(suggestSlug(event.target.value))} className={`mt-1 block w-40 ${fieldClass}`} />
        </label>
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Password</span>
          <input value={password} type="password" autoComplete="new-password" aria-label="Client password" onChange={(event) => setPassword(event.target.value)} className={`mt-1 block w-44 ${fieldClass}`} />
        </label>
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Deal</span>
          <input value={dealName} aria-label="Deal name" onChange={(event) => setDealName(event.target.value)} className={`mt-1 block w-48 ${fieldClass}`} />
        </label>
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Deal address</span>
          <input value={dealSlug} aria-label="Deal address" onChange={(event) => setDealSlug(event.target.value)} onBlur={(event) => setDealSlug(suggestSlug(event.target.value))} className={`mt-1 block w-32 ${fieldClass}`} />
        </label>
      </div>
      <div className="mt-3">
        <SettingsButton type="submit" variant="primary" disabled={busy || !orgId || !slug || !password.trim() || !dealName.trim() || !dealSlug}>
          Start workspace
        </SettingsButton>
      </div>
    </form>
  );
}

function AccountBlock({
  account,
  pitches,
  busy,
  copied,
  focusOpportunityId,
  opportunityTitle,
  onCopy,
  onAccount,
  onDeal,
  onDealPatch,
  onRow,
}: {
  account: Account;
  pitches: PitchChoice[];
  busy: boolean;
  copied: string | null;
  focusOpportunityId?: string;
  opportunityTitle?: string;
  onCopy: (href: string) => void;
  onAccount: (payload: Record<string, string | boolean>) => void;
  onDeal: (payload: Record<string, string | boolean | null>) => void;
  onDealPatch: (dealId: string, payload: Record<string, string | boolean>) => void;
  onRow: (dealId: string, payload: Record<string, unknown>) => void;
}) {
  const [slug, setSlug] = useState(account.slug);
  const [password, setPassword] = useState("");
  const [dealName, setDealName] = useState(opportunityTitle || "Next deal");
  const [dealSlug, setDealSlug] = useState(suggestSlug(opportunityTitle || "next") || "next");
  useEffect(() => setSlug(account.slug), [account.slug]);
  const missingOpportunity =
    Boolean(focusOpportunityId) && !account.deals.some((deal) => deal.salesOpportunityId === focusOpportunityId);

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">{account.organizationName || account.slug}</h2>
        <p className="text-xs text-white/50">{account.protected ? "Password on" : "No password"}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Address</span>
          <input value={slug} aria-label={`${account.organizationName || "Client"} address`} onChange={(event) => setSlug(event.target.value)} onBlur={(event) => setSlug(suggestSlug(event.target.value))} className={`mt-1 block w-40 ${fieldClass}`} />
        </label>
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">New password</span>
          <input value={password} type="password" autoComplete="new-password" aria-label="New client password" placeholder="Leave blank to keep" onChange={(event) => setPassword(event.target.value)} className={`mt-1 block w-48 ${fieldClass}`} />
        </label>
        <SettingsButton
          variant="primary"
          disabled={busy || !slug}
          onClick={() => {
            const nextPassword = password.trim();
            setPassword("");
            onAccount({ slug: suggestSlug(slug), ...(nextPassword ? { password: nextPassword } : {}) });
          }}
        >
          Save address
        </SettingsButton>
        {account.protected ? (
          <SettingsButton disabled={busy} onClick={() => onAccount({ clearPassword: true })}>
            Remove password
          </SettingsButton>
        ) : null}
      </div>

      {account.deals.map((deal) => (
        <DealBlock
          key={deal.id}
          accountSlug={account.slug}
          deal={deal}
          pitches={pitches.filter((pitch) => !pitch.organizationId || pitch.organizationId === account.organizationId)}
          busy={busy}
          copied={copied}
          emphasized={!focusOpportunityId || deal.salesOpportunityId === focusOpportunityId}
          onCopy={onCopy}
          onPatch={(payload) => onDealPatch(deal.id, payload)}
          onRow={(payload) => onRow(deal.id, payload)}
        />
      ))}

      {missingOpportunity || !focusOpportunityId ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--csc-row-divider)] pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            onDeal({
              organizationId: account.organizationId,
              name: dealName,
              slug: dealSlug,
              salesOpportunityId: missingOpportunity ? focusOpportunityId ?? null : null,
              current: account.deals.length === 0,
            });
          }}
        >
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">
              {missingOpportunity ? "This opportunity" : "Another deal"}
            </span>
            <input value={dealName} aria-label="New deal name" onChange={(event) => setDealName(event.target.value)} className={`mt-1 block w-48 ${fieldClass}`} />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Deal address</span>
            <input value={dealSlug} aria-label="New deal address" onChange={(event) => setDealSlug(event.target.value)} onBlur={(event) => setDealSlug(suggestSlug(event.target.value))} className={`mt-1 block w-32 ${fieldClass}`} />
          </label>
          <SettingsButton type="submit" variant="primary" disabled={busy || !dealName.trim() || !dealSlug}>
            Add deal
          </SettingsButton>
        </form>
      ) : null}
    </div>
  );
}

function DealBlock({
  accountSlug,
  deal,
  pitches,
  busy,
  copied,
  emphasized,
  onCopy,
  onPatch,
  onRow,
}: {
  accountSlug: string;
  deal: Deal;
  pitches: PitchChoice[];
  busy: boolean;
  copied: string | null;
  emphasized: boolean;
  onCopy: (href: string) => void;
  onPatch: (payload: Record<string, string | boolean>) => void;
  onRow: (payload: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(deal.name);
  const [slug, setSlug] = useState(deal.slug);
  useEffect(() => setName(deal.name), [deal.name]);
  useEffect(() => setSlug(deal.slug), [deal.slug]);
  return (
    <div className={`mt-5 ${emphasized ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{deal.opportunityTitle || deal.name}</h3>
        {deal.current ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Current</span>
        ) : (
          <SettingsButton disabled={busy} onClick={() => onPatch({ current: true })}>
            Make current
          </SettingsButton>
        )}
      </div>
      <p className="mt-1 text-xs text-white/45">
        {deal.current ? `/for/${accountSlug}` : `/for/${accountSlug}/${deal.slug}`} is the link you send. The deal address stays available either way.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <input value={name} aria-label="Deal name" onChange={(event) => setName(event.target.value)} className={`w-48 ${fieldClass}`} />
        <input value={slug} aria-label="Deal address" onChange={(event) => setSlug(event.target.value)} onBlur={(event) => setSlug(suggestSlug(event.target.value))} className={`w-32 ${fieldClass}`} />
        <SettingsButton disabled={busy || !name.trim() || !slug} onClick={() => onPatch({ name, slug })}>
          Save deal
        </SettingsButton>
      </div>
      <div className="mt-3">
        {deal.rows.map((row) => (
          <RowEditor
            key={`${row.role}:${row.placementId ?? "new"}:${row.href ?? ""}:${row.pitchId ?? ""}:${row.published}`}
            row={row}
            pitches={pitches}
            busy={busy}
            copied={copied === row.href}
            onCopy={() => row.href && onCopy(row.href)}
            onSave={(payload) => onRow({ role: row.role, ...payload })}
          />
        ))}
      </div>
    </div>
  );
}

function RowEditor({
  row,
  pitches,
  busy,
  copied,
  onCopy,
  onSave,
}: {
  row: Row;
  pitches: PitchChoice[];
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [pathSlug, setPathSlug] = useState(row.pathSlug ?? "");
  const [title, setTitle] = useState(row.title);
  const [body, setBody] = useState(row.body);
  const [linkUrl, setLinkUrl] = useState(row.linkUrl ?? "");
  const [linkLabel, setLinkLabel] = useState(row.linkLabel ?? "");
  const [published, setPublished] = useState(row.published);
  const [pitchId, setPitchId] = useState(row.pitchId ?? "");
  const deckLike = row.role === "deck" || row.role === "show";
  const pageSlug = pathSlug || (row.role === "deck" ? null : row.role);

  return (
    <div className="border-t border-[var(--csc-row-divider)] py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="csc-eyebrow">{row.label}</p>
        <div className="flex flex-wrap gap-2">
          {row.href ? (
            <SettingsButton onClick={onCopy}>{copied ? "Copied" : "Copy link"}</SettingsButton>
          ) : null}
          {row.pitchId ? (
            <SettingsButton href={`/admin/settings/pitches/${row.pitchId}`}>Open</SettingsButton>
          ) : null}
          {row.placementId ? (
            <SettingsButton disabled={busy} onClick={() => onSave({ remove: true })}>
              Remove
            </SettingsButton>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-xs text-white/45">
        {row.href ? row.href : "Not on the client address yet."}
        {row.pitchId ? (row.pitchLive ? " · Live" : " · Hidden until the deck is live") : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Page address</span>
          <input
            value={pathSlug}
            aria-label={`${row.label} address`}
            placeholder={row.role === "deck" ? "Blank uses the deal link" : row.role}
            onChange={(event) => setPathSlug(event.target.value)}
            onBlur={(event) => setPathSlug(suggestSlug(event.target.value))}
            className={`mt-1 block w-48 ${fieldClass}`}
          />
        </label>
        {!deckLike ? (
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Title</span>
            <input value={title} aria-label={`${row.label} title`} onChange={(event) => setTitle(event.target.value)} className={`mt-1 block w-48 ${fieldClass}`} />
          </label>
        ) : null}
      </div>
      {row.role === "proposal" || row.role === "show" ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[16rem] flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">
              {row.role === "proposal" ? "Dropbox Sign link" : "Link"}
            </span>
            <input value={linkUrl} aria-label={`${row.label} link`} placeholder="https://" onChange={(event) => setLinkUrl(event.target.value)} className={`mt-1 block w-full ${fieldClass}`} />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Link label</span>
            <input value={linkLabel} aria-label={`${row.label} link label`} placeholder={row.role === "proposal" ? "Sign" : "Open"} onChange={(event) => setLinkLabel(event.target.value)} className={`mt-1 block w-32 ${fieldClass}`} />
          </label>
        </div>
      ) : null}
      {row.role === "notes" || row.role === "proposal" ? (
        <label className="mt-2 block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">
            {row.role === "notes" ? "Notes" : "Note on the page"}
          </span>
          <textarea value={body} aria-label={`${row.label} text`} rows={row.role === "notes" ? 4 : 2} onChange={(event) => setBody(event.target.value)} className={`mt-1 w-full ${fieldClass} px-3 py-2`} />
        </label>
      ) : null}
      {deckLike ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!row.pitchId ? (
            <SettingsButton variant="primary" disabled={busy} onClick={() => onSave({ pathSlug: pageSlug, createPitch: true, published: true })}>
              Create {row.label.toLowerCase()}
            </SettingsButton>
          ) : null}
          <select
            aria-label={`Use an existing ${row.label.toLowerCase()}`}
            value={pitchId}
            onChange={(event) => setPitchId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Use an existing deck</option>
            {pitches.map((pitch) => (
              <option key={pitch.id} value={pitch.id}>
                {pitch.name}
                {pitch.live ? "" : " (hidden)"}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mt-2">
          <SettingsButton variant={published ? "primary" : "ghost"} onClick={() => setPublished((on) => !on)}>
            {published ? "Live" : "Hidden"}
          </SettingsButton>
        </div>
      )}
      <div className="mt-2">
        <SettingsButton
          variant="primary"
          disabled={busy}
          onClick={() =>
            onSave({
              pathSlug: pageSlug,
              title,
              body,
              linkUrl: linkUrl.trim() || null,
              linkLabel: linkLabel.trim() || null,
              published: deckLike ? true : published,
              pitchId: pitchId || null,
            })
          }
        >
          Save {row.label.toLowerCase()}
        </SettingsButton>
      </div>
    </div>
  );
}
