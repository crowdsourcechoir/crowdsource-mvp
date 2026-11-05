export type HomeCityAssignment = {
  applied: boolean;
  already: boolean;
  spokane: number;
  boise: number;
  seattle: number;
  cities: { value: string; count: number }[];
  tags: { value: string; count: number }[];
};

/**
 * Retired. City lists are uploaded and matched by email.
 * This stays so an older cron cannot relabel the whole audience.
 */
export async function assignHomeCities(): Promise<HomeCityAssignment> {
  return { applied: false, already: true, spokane: 0, boise: 0, seattle: 0, cities: [], tags: [] };
}
