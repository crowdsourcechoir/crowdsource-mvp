import { requireSupabaseAdmin } from "./client";
import type { IndustrySegment, OpportunityType, Organization, OrganizationType } from "../types";

function rowToOrganizationType(row: Record<string, unknown>): OrganizationType {
  return {
    id: row.id as string,
    key: row.key as string,
    label: row.label as string,
    industrySegmentId: (row.industry_segment_id as string | null) ?? null,
    isActive: (row.is_active as boolean) ?? true,
  };
}

function rowToOpportunityType(row: Record<string, unknown>): OpportunityType {
  return {
    id: row.id as string,
    key: row.key as string,
    label: row.label as string,
    isActive: (row.is_active as boolean) ?? true,
  };
}

function rowToIndustrySegment(row: Record<string, unknown>): IndustrySegment {
  return { id: row.id as string, key: row.key as string, label: row.label as string };
}

export async function listOrganizationTypes(): Promise<OrganizationType[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("organization_types").select("*").order("label");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOrganizationType);
}

export async function listOpportunityTypes(): Promise<OpportunityType[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("opportunity_types").select("*").order("label");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOpportunityType);
}

export async function listIndustrySegments(): Promise<IndustrySegment[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("industry_segments").select("*").order("label");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToIndustrySegment);
}

export async function findOrganizationTypeByKey(key: string): Promise<OrganizationType | null> {
  const types = await listOrganizationTypes();
  return types.find((t) => t.key === key) ?? null;
}

export async function findOpportunityTypeByKey(key: string): Promise<OpportunityType | null> {
  const types = await listOpportunityTypes();
  return types.find((t) => t.key === key) ?? null;
}

/**
 * Resolves an organization's *effective* industry segment: its own `industrySegmentId` override
 * if set, else whatever its `organizationTypeId` inherits (see
 * supabase/sales-platform-add-industry-segment-override.sql for why the override exists — e.g.
 * `organization_type = 'association'` alone can't distinguish ISACS from a healthcare
 * association). Used by drafting (stage 8) to pick a segment-targeted outreach template — see
 * lib/sales/db/outreach.ts#findApprovedTemplate.
 */
export async function resolveIndustrySegmentIdForOrganization(org: Organization): Promise<string | null> {
  if (org.industrySegmentId) return org.industrySegmentId;
  if (!org.organizationTypeId) return null;
  const types = await listOrganizationTypes();
  return types.find((t) => t.id === org.organizationTypeId)?.industrySegmentId ?? null;
}
