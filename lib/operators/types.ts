export type OperatorRole = "owner" | "member";
export type OperatorStatus = "invited" | "active" | "disabled";
export type GrantCapability = "compose" | "steward" | "sales";
export type GrantScopeType = "bloom" | "garden" | "sales";

export type OperatorGrant = {
  id?: string;
  capability: GrantCapability;
  scopeType: GrantScopeType;
  scopeId: string | null;
};

export type OperatorRecord = {
  id: string;
  email: string;
  name: string;
  role: OperatorRole;
  status: OperatorStatus;
  sessionVersion: number;
  hasPassword: boolean;
  grants: OperatorGrant[];
};

/** Signed into the session cookie. Grants are expanded at sign-in. */
export type Actor = {
  id: string;
  email: string;
  name: string;
  role: OperatorRole;
  sessionVersion: number;
  /** Legacy shared-password cookie. Treated as owner until the next sign-in. */
  legacy: boolean;
  sales: boolean;
  stewardBlooms: string[];
  composeBlooms: string[];
  stewardGardens: string[];
  composeGardens: string[];
};

export type NavAccess = {
  gardens: boolean;
  blooms: boolean;
  composer: boolean;
  sales: boolean;
  marketing: boolean;
  live: boolean;
  settings: boolean;
};
