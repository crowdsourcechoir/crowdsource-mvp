import { listOutreachActivitiesByTypes } from "./activities";
import { listContactsByIds } from "./contacts";
import { listOpportunitiesByIds } from "./opportunities";
import { listOrganizationsByIds } from "./organizations";
import { buildFirstTouchSnapshot, type FirstTouchSnapshot, type MetricActivity } from "../outreach/first-touch-metrics";

export async function loadFirstTouchSnapshot(): Promise<FirstTouchSnapshot> {
  const activities = await listOutreachActivitiesByTypes(["sent", "replied", "bounced"]);
  const opportunityIds = Array.from(new Set(activities.map((a) => a.opportunityId)));
  const contactIds = Array.from(
    new Set(activities.map((a) => a.contactId).filter((id): id is string => Boolean(id)))
  );

  const [opportunities, contacts] = await Promise.all([
    listOpportunitiesByIds(opportunityIds),
    listContactsByIds(contactIds),
  ]);
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const organizations = await listOrganizationsByIds(
    Array.from(new Set(opportunities.map((o) => o.organizationId)))
  );
  const organizationById = new Map(organizations.map((o) => [o.id, o]));

  const rows: MetricActivity[] = activities.map((activity) => {
    const opportunity = opportunityById.get(activity.opportunityId);
    const contact = activity.contactId ? contactById.get(activity.contactId) : undefined;
    const organization = opportunity ? organizationById.get(opportunity.organizationId) : undefined;
    return {
      id: activity.id,
      opportunityId: activity.opportunityId,
      contactId: activity.contactId,
      activityType: activity.activityType,
      occurredAt: activity.occurredAt,
      metadata: activity.metadata,
      gmailThreadId: activity.gmailThreadId,
      organizationName: organization?.name ?? null,
      contactName: contact?.fullName ?? null,
      contactEmail: contact?.email ?? null,
      opportunityTitle: opportunity?.title ?? null,
      relationshipStage: opportunity?.relationshipStage ?? null,
    };
  });

  return buildFirstTouchSnapshot(rows);
}
