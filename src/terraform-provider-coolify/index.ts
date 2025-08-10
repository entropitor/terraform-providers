import { coolifyProviderBuilder } from "./builder.js";
import { coolifyProject } from "./resources/project.js";

coolifyProviderBuilder.serve({
  datasources: {},
  resources: {
    coolify_project: coolifyProject,
  },
});
