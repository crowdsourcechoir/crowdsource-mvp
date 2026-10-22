export type SegmentAttributeField = "city" | "region" | "country" | "acquisition_source";

export type SegmentCondition =
  | { type: "attribute"; field: SegmentAttributeField; op: "eq"; value: string }
  | { type: "tag"; op: "has" | "eq"; value: string }
  | { type: "subscription"; topic: "marketing"; status: "subscribed" | "unsubscribed" | "pending" };

export type SegmentDefinition = {
  schemaVersion: 1;
  match: "all";
  conditions: SegmentCondition[];
};
