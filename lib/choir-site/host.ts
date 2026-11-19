/** Hosts that keep the operator sign-in on `/`. Everywhere else, `/` is the public choir site. */
const OPERATOR_HOSTS = new Set(["app.crowdsourcechoir.com", "localhost", "127.0.0.1"]);

export function showsOperatorHome(hostHeader: string | null | undefined): boolean {
  const host = (hostHeader || "").split(",")[0]?.trim().toLowerCase() || "";
  const hostname = host.replace(/:\d+$/, "");
  return OPERATOR_HOSTS.has(hostname);
}
