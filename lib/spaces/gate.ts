import { createHmac } from "crypto";

export const ACCOUNT_AUTH_COOKIE = "for_account_auth";

export function accountGateCookie(account: { organizationId: string; slug: string; passwordHash: string }): {
  name: string;
  value: string;
  path: string;
} {
  return {
    name: ACCOUNT_AUTH_COOKIE,
    value: createHmac("sha256", account.passwordHash).update(`for:${account.organizationId}`).digest("hex"),
    path: `/for/${account.slug}`,
  };
}
