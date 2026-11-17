/**
 * Soft hold so a seeded organization stays out of the automatic digest / batch pipeline.
 * A person can still run the pipeline from the organization page.
 * Stored on organizations.import_metadata — no migration required.
 */

export function isHeldFromAutoPipeline(
  importMetadata: Record<string, unknown> | null | undefined
): boolean {
  return Boolean(importMetadata && importMetadata.holdAutoPipeline === true);
}
