import { z } from "zod";

/** Fields extracted from a business-card photo (null when not visible on the card). */
export const BusinessCardExtractSchema = z.object({
  fullName: z.string().nullable().describe("Person's full name as printed"),
  roleTitle: z.string().nullable().describe("Job title / role"),
  organizationName: z.string().nullable().describe("Company or organization name"),
  email: z.string().nullable().describe("Email address if printed"),
  phone: z.string().nullable().describe("Phone number if printed"),
  websiteUrl: z.string().nullable().describe("Website or domain if printed"),
  linkedinUrl: z.string().nullable().describe("LinkedIn URL if printed"),
  notes: z
    .string()
    .nullable()
    .describe("Any other useful printed text (address, event name) — short"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall read confidence 0–1"),
});

export type BusinessCardExtract = z.infer<typeof BusinessCardExtractSchema>;

export const EMPTY_CARD_EXTRACT: BusinessCardExtract = {
  fullName: null,
  roleTitle: null,
  organizationName: null,
  email: null,
  phone: null,
  websiteUrl: null,
  linkedinUrl: null,
  notes: null,
  confidence: 0,
};
