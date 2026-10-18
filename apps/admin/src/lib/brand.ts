import {brandConfig, deploymentKind, publicUrl} from "../../../../packages/config/deployment.mjs";

const kind = deploymentKind(process.env.NEXT_PUBLIC_ADMIN_DEPLOYMENT_KIND);
export const adminBrand = brandConfig(kind, {
  displayName: process.env.NEXT_PUBLIC_ADMIN_BRAND_NAME,
  description: process.env.NEXT_PUBLIC_ADMIN_BRAND_DESCRIPTION,
  accentColor: process.env.NEXT_PUBLIC_ADMIN_ACCENT_COLOR,
  accentContrastColor: process.env.NEXT_PUBLIC_ADMIN_ACCENT_CONTRAST_COLOR,
});
export const adminLogo = kind === "client" && process.env.NEXT_PUBLIC_ADMIN_LOGO_URL
  ? publicUrl(process.env.NEXT_PUBLIC_ADMIN_LOGO_URL, "admin logo URL") : "";
