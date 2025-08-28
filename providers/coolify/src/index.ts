import { coolifyProviderBuilder } from "./builder.js";
import {
  coolifyServerDataSource,
  coolifyServersDataSource,
} from "./datasources/server.js";
import { coolifyProject } from "./resources/project.js";
import { coolifyService } from "./resources/service.js";

coolifyProviderBuilder.serve({
  name: "coolify",
  datasources: {
    server: coolifyServerDataSource,
    servers: coolifyServersDataSource,
  },
  resources: {
    project: coolifyProject,
    service: coolifyService,
  },
});
