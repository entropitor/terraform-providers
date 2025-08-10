import { coolifyProviderBuilder } from "./builder.js";
import { coolifyServerDataSource } from "./datasources/server.js";
import { coolifyProject } from "./resources/project.js";

coolifyProviderBuilder.serve({
  datasources: {
    coolify_server: coolifyServerDataSource,
  },
  resources: {
    coolify_project: coolifyProject,
  },
});
