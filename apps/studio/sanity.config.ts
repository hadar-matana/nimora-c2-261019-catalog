import {target, studioName, studioTitle} from "./deployment";
import {defineConfig} from "sanity";
import {structureTool} from "sanity/structure";
import {schemaTypes} from "./schemaTypes";
import {structure} from "./structure";

export default defineConfig({
  name: studioName!,
  title: studioTitle!,
  projectId: target.projectId,
  dataset: target.dataset,
  plugins: [structureTool({structure})],
  schema: {
    types: schemaTypes
  }
});
