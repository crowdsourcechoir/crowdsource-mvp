import { z } from "zod";
import { SECTION_TYPES, type EmailDocument } from "./types";

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SECTION_TYPES),
  spacing: z.enum(["small", "medium", "large", "xl"]),
  background: z.enum(["canvas", "surface", "brand", "ink", "custom"]),
  customBackground: z.string().optional(),
  align: z.enum(["left", "center"]),
  hideOnMobile: z.boolean(),
  props: z.record(z.string(), z.unknown()),
});

export const emailDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  designSystemId: z.string().min(1),
  meta: z.object({ internalTitle: z.string() }),
  personalization: z.object({
    missingTokenBehavior: z.enum(["blank", "fallback"]),
    fallbacks: z.object({
      first_name: z.string().optional(),
      display_name: z.string().optional(),
    }),
  }),
  sections: z.array(sectionSchema),
});

export function parseEmailDocument(raw: unknown): EmailDocument {
  const parsed = emailDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "document";
    throw new Error(`Invalid email document at ${path}: ${issue?.message ?? "invalid"}`);
  }
  return parsed.data;
}
