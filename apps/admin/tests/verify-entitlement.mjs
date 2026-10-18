import { readFile, writeFile } from "node:fs/promises";
const config = await readFile(
  "/Users/hadarmatana/Library/Preferences/.wrangler/config/default.toml",
  "utf8",
);
const token = config.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
if (!token)
  throw new Error(
    "Existing Wrangler OAuth credential unavailable; no credential was created.",
  );
const account = "07eb45a2b5a037d1138beea811cf549b";
const routes = [
  "/user",
  `/accounts/${account}/workers/account-settings`,
  `/accounts/${account}/workers/durable_objects/namespaces`,
  `/accounts/${account}/subscriptions`,
];
const results = await Promise.all(
  routes.map(async (path) => {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4" + path,
      { method: "GET", headers: { Authorization: "Bearer " + token } },
    );
    const data = await response.json();
    const output = {
      path,
      status: response.status,
      success: data.success,
      errorCodes: (data.errors ?? []).map((e) => e.code),
    };
    if (path === "/user")
      output.personalIdentityMatches =
        data.result?.email === "hadarmat@gmail.com";
    else if (path.endsWith("account-settings") && data.success)
      output.settings = data.result;
    else if (path.endsWith("namespaces") && data.success)
      output.namespaces = {
        count: data.result.length,
        sqliteCount: data.result.filter((n) => n.use_sqlite === true).length,
      };
    else if (path.endsWith("subscriptions") && data.success)
      output.subscriptions = data.result.map((r) => ({
        ratePlan: r.rate_plan?.id,
        product: r.rate_plan?.public_name,
        state: r.state,
      }));
    return output;
  }),
);
const result = {
  checkedAt: new Date().toISOString(),
  method:
    "GET only, existing OAuth credential; no provisioning or billing mutations",
  userReportedDashboard: {
    workersFreeAllowancePerDay: 100000,
    currentUsage: 0,
    durableObjectsDashboardAccessible: true,
    upgradePromptObserved: false,
  },
  results,
};
await writeFile(
  new URL(
    "../../../docs/admin-screenshots/final-entitlement-check.json",
    import.meta.url,
  ),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
