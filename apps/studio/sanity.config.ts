import {defineConfig} from "sanity";
import {structureTool} from "sanity/structure";
import {schemaTypes} from "./schemaTypes";
import {structure} from "./structure";

export default defineConfig({
  name: "fashion-catalog-demo",
  title: "Fashion Catalog Demo",
  projectId: "3ahm0828",
  dataset: "production",
  plugins: [structureTool({structure})],
  schema: {
    types: schemaTypes
  }
});
