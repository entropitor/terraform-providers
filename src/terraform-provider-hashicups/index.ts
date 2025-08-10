import { serveProvider } from "./serve.js";
import { hashicupsProvider } from "./hashicups/HashicupsProvider.js";

serveProvider(hashicupsProvider);
