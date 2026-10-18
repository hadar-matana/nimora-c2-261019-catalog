import {adminBrand, adminLogo} from "@/lib/brand";
export function Brand() {
  return adminLogo ? <img src={adminLogo} alt={adminBrand.name} style={{maxHeight: 48, maxWidth: 180, objectFit: "contain"}} /> : <>{adminBrand.name}</>;
}
