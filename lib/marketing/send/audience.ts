import type { SegmentCondition, SegmentDefinition } from "../segments/definition";

export type AudiencePerson = {
  personId: string;
  subscriptionId: string;
  email: string;
  firstName: string | null;
  displayName: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  acquisitionSource: string | null;
  tags: string[];
  subscriptionStatus: string;
  suppressed: boolean;
};

export function personMatchesSegment(person: AudiencePerson, definition: SegmentDefinition): boolean {
  if (definition.match !== "all") return false;
  if (definition.conditions.length === 0) return false;
  return definition.conditions.every((condition) => matches(person, condition));
}

function matches(person: AudiencePerson, condition: SegmentCondition): boolean {
  if (condition.type === "subscription") {
    return condition.topic === "marketing" && person.subscriptionStatus === condition.status;
  }
  if (condition.type === "tag") {
    return person.tags.includes(condition.value.trim().toLowerCase());
  }
  if (condition.type !== "attribute") return false;
  const field =
    condition.field === "city"
      ? person.city
      : condition.field === "region"
        ? person.region
        : condition.field === "country"
          ? person.country
          : person.acquisitionSource;
  return (field ?? "").trim().toLowerCase() === condition.value.trim().toLowerCase();
}

export function sendablePeople(people: AudiencePerson[], definition: SegmentDefinition): AudiencePerson[] {
  return people.filter((person) => !person.suppressed && person.subscriptionStatus === "subscribed" && personMatchesSegment(person, definition));
}
