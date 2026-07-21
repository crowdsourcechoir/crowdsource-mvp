import { requireSupabaseAdmin } from "./client";
import type { IndustrySegment, OpportunityType, OrganizationType } from "../types";

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
