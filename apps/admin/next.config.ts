import type { NextConfig } from "next";

// Local integration only: public deployment still requires a separate approved configuration.
if (process.env.VERCEL || process.env.CF_PAGES) {
  throw new Error("ATELIER admin Phase B must not be deployed publicly.");
}

const proof = process.env.ADMIN_LOCAL_PROOF !== "0";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  ...(proof ? { output: "export", trailingSlash: true } : {}),
  env: { NEXT_PUBLIC_ADMIN_LOCAL_PROOF: proof ? "1" : "0" },
};
export default config;
