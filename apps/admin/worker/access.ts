// Deployment is opt-in. Local defaults cannot expose the admin on public hosts.
export type AccessEnv = {
  LOCAL_COMPAT_PROOF?: string;
  ADMIN_REMOTE_ENABLED?: string;
  ADMIN_ORIGIN: string;
  SANITY_MODE?: string;
  SANITY_API_TOKEN?: string;
  OWNER_USERNAME?: string;
  OWNER_PASSWORD_HASH?: string;
  CREDENTIAL_VERSION?: string;
};
export function allowedHost(env: AccessEnv, address: string) {
  const url = new URL(address);
  if (env.LOCAL_COMPAT_PROOF === "1")
    return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    env.ADMIN_REMOTE_ENABLED !== "approved" ||
    env.SANITY_MODE !== "production" ||
    !env.SANITY_API_TOKEN ||
    !env.OWNER_USERNAME ||
    !env.CREDENTIAL_VERSION ||
    !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(env.OWNER_PASSWORD_HASH ?? "")
  )
    return false;
  try {
    const expected = new URL(env.ADMIN_ORIGIN);
    return (
      expected.protocol === "https:" &&
      url.origin === expected.origin &&
      !expected.username &&
      !expected.password &&
      expected.pathname === "/" &&
      !expected.search &&
      !expected.hash
    );
  } catch {
    return false;
  }
}
