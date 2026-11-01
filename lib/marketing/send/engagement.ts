export type DeliveryEngagementRow = {
  status: string;
  recordedOpenCount: number;
  clickCount: number;
};

export type EngagementStats = {
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
};

/** Unique recipients. Opens are recorded opens, not a promise the inbox showed the message. */
export function engagementStats(rows: DeliveryEngagementRow[], unsubscribedEvents: number): EngagementStats {
  let delivered = 0;
  let bounced = 0;
  let complained = 0;
  let opened = 0;
  let clicked = 0;
  for (const row of rows) {
    const recordedOpen = row.recordedOpenCount > 0;
    const recordedClick = row.clickCount > 0;
    if (row.status === "bounced") bounced += 1;
    if (row.status === "complained") complained += 1;
    if (row.status === "delivered" || row.status === "complained" || recordedOpen || recordedClick) delivered += 1;
    if (recordedOpen) opened += 1;
    if (recordedClick) clicked += 1;
  }
  return {
    delivered,
    bounced,
    complained,
    opened,
    clicked,
    unsubscribed: unsubscribedEvents + complained,
  };
}
