export type SessionPolicy = {
  LOCAL_COMPAT_PROOF?: string;
  LOCAL_SESSION_TTL_MS?: string;
  SESSION_TTL_SECONDS?: string;
};

// An operator may shorten expiry for controlled acceptance tests. The default
// stays eight hours; the browser never controls this value.
export function sessionLifetime(env: SessionPolicy) {
  if (env.LOCAL_COMPAT_PROOF === "1" && env.LOCAL_SESSION_TTL_MS)
    return Math.min(28_800_000, Math.max(1, Number(env.LOCAL_SESSION_TTL_MS) || 28_800_000));
  if (env.SESSION_TTL_SECONDS === undefined) return 28_800_000;
  const seconds = Number(env.SESSION_TTL_SECONDS);
  if (!/^\d+$/.test(env.SESSION_TTL_SECONDS) || seconds < 60 || seconds > 28_800)
    throw new Error("Invalid operator session lifetime");
  return seconds * 1000;
}
