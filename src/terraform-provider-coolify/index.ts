import { coolifyProviderBuilder } from "./builder.js";
import {
  coolifyServerDataSource,
  coolifyServersDataSource,
} from "./datasources/server.js";
import { coolifyProject } from "./resources/project.js";

coolifyProviderBuilder.serve({
  datasources: {
    coolify_server: coolifyServerDataSource,
    coolify_servers: coolifyServersDataSource,
  },
  resources: {
    coolify_project: coolifyProject,
  },
});
