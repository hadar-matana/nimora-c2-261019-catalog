import {target} from "./deployment";
import {defineCliConfig} from "sanity/cli";

const appId = process.env.SANITY_STUDIO_APP_ID;
if (!appId || !/^[a-zA-Z0-9_-]+$/.test(appId)) throw new Error("Explicit Studio app ID is required; automatic deployment identity is disabled");

export default defineCliConfig({
  api: {
    projectId: target.projectId,
    dataset: target.dataset
  },
  deployment: {
    appId
  }
});
