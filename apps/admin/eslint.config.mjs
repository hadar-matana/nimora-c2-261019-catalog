import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    // Local mock photos and browser-selected data URLs intentionally bypass an
    // image optimization service. All imagery is bounded by responsive CSS.
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    ignores: [".next/**", "out/**", "next-env.d.ts", ".wrangler/**"],
  },
];

export default eslintConfig;
