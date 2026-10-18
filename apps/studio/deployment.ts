import {cmsTarget, deploymentKind} from "../../packages/config/deployment.mjs";

export const target = cmsTarget(process.env.SANITY_STUDIO_PROJECT_ID, process.env.SANITY_STUDIO_DATASET, process.env.SANITY_STUDIO_API_VERSION);
export const kind = deploymentKind(process.env.SANITY_STUDIO_DEPLOYMENT_KIND);
export const studioName = process.env.SANITY_STUDIO_NAME;
export const studioTitle = process.env.SANITY_STUDIO_TITLE;
if (!studioName || !/^[a-z0-9][a-z0-9-]*$/.test(studioName) || !studioTitle?.trim()) throw new Error("Studio name and title are required");
