export {
  getPerson as getMarketingPerson,
  listPeople as listMarketingPeople,
  unsubscribeByEmail as unsubscribePersonByEmail,
  upsertPerson as upsertMarketingPerson,
} from "./db/people";

export type { UpsertPersonInput, UpsertPersonResult } from "./db/people";
