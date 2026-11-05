import type { MarketingPerson } from "./types";

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function audienceToCsv(people: MarketingPerson[]): string {
  const header = ["Email", "Name", "City", "State", "Country", "Status", "Tags", "Source"];
  const lines = people.map((person) =>
    [
      person.email,
      person.displayName ?? "",
      person.city ?? "",
      person.region ?? "",
      person.country ?? "",
      person.status,
      person.tags.join(", "),
      person.acquisitionSource,
    ]
      .map((value) => csvCell(value))
      .join(",")
  );
  return `${header.join(",")}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}
