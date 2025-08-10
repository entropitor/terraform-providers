import { serveProvider } from "../provider-sdk/serve.js";
import { hashicupsProvider } from "./HashicupsProvider.js";

serveProvider(hashicupsProvider);
