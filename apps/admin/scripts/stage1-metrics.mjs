import "./legacy-demo-only.mjs";
// Read-only GraphQL analytics; no auth headers, cookies or raw request logs.
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
const config=await readFile(homedir()+"/Library/Preferences/.wrangler/config/default.toml","utf8");
const token=config.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
const daily=process.argv.includes("--daily");
const start=daily?new Date().toISOString().slice(0,10)+"T00:00:00Z":"2026-10-15T18:35:00Z";
const query=`query {
  viewer { accounts(filter: {accountTag: "07eb45a2b5a037d1138beea811cf549b"}) {
    workersInvocationsAdaptive(limit: 1000, filter: {scriptName: "atelier-admin", datetime_geq: "${start}"}) {
      sum {requests errors subrequests}
      quantiles {cpuTimeP50 cpuTimeP99 memoryUsageBytesP50 memoryUsageBytesP99}
      dimensions {datetime scriptName status}
    }
    durableObjectsInvocationsAdaptiveGroups(limit: 1000, filter: {datetime_geq: "${start}"}) {
      sum {requests responseBodySize}
    }
    durableObjectsPeriodicGroups(limit: 1000, filter: {datetime_geq: "${start}"}) {
      sum {cpuTime activeTime duration rowsRead rowsWritten exceededCpuErrors exceededMemoryErrors fatalInternalErrors}
      quantiles {memoryUsageBytesP50 memoryUsageBytesP99}
    }
    durableObjectsStorageGroups(limit: 1000, filter: {datetime_geq: "${start}"}) {
      max {storedBytes}
    }
  }}
}`;
const r=await fetch("https://api.cloudflare.com/client/v4/graphql",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});
const data=await r.json();
const result={at:new Date().toISOString(),start,httpStatus:r.status,qualification:"Real remote Cloudflare sampled analytics, not load/peak/billing guarantees; CPU quantiles are microseconds and memory quantiles bytes.",...data};
await writeFile(new URL("../../../docs/admin-screenshots/"+(daily?"stage1-daily-usage.json":"stage1-remote-metrics.json"),import.meta.url),JSON.stringify(result,null,2)+"\n");
const a=data.data?.viewer?.accounts?.[0];const rows=a?.workersInvocationsAdaptive??[];
console.log(JSON.stringify({httpStatus:r.status,errors:data.errors,workerRows:rows.length,requests:rows.reduce((n,r)=>n+r.sum.requests,0),errorsTotal:rows.reduce((n,r)=>n+r.sum.errors,0),maxReportedCpuP99Ms:Math.max(0,...rows.map(r=>r.quantiles.cpuTimeP99/1000)),maxReportedMemoryP99MiB:Math.max(0,...rows.map(r=>r.quantiles.memoryUsageBytesP99/1048576)),durableInvocations:a?.durableObjectsInvocationsAdaptiveGroups,durablePeriodic:a?.durableObjectsPeriodicGroups,durableStorage:a?.durableObjectsStorageGroups},null,2));
