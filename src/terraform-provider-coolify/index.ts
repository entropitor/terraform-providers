import { coolifyProviderBuilder } from "./builder.js";
import {
  coolifyServerDataSource,
  coolifyServersDataSource,
} from "./datasources/server.js";
import { coolifyProject } from "./resources/project.js";
import { coolifyService } from "./resources/service.js";

coolifyProviderBuilder.serve({
  datasources: {
    coolify_server: coolifyServerDataSource,
    coolify_servers: coolifyServersDataSource,
  },
  resources: {
    coolify_project: coolifyProject,
    coolify_service: coolifyService,
  },
});
