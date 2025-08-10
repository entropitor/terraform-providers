import type { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import http from "node:http2";
import forge from "node-forge";

import { Health } from "../gen/grpc/health/v1/health_connect.js";
import { HealthCheckResponse_ServingStatus } from "../gen/grpc/health/v1/health_pb.js";
import { GRPCStdio } from "../gen/plugin/grpc_stdio_connect.js";
import { Provider } from "../gen/tfplugin6/tfplugin6.7_connect.js";
import { generateIdentity } from "../certificate.js";
import { GRPCController } from "../gen/plugin/grpc_controller_connect.js";
import { hashicupsProvider } from "./hashicups/HashicupsProvider.js";

const providerInstanceId = hashicupsProvider.providerInstanceId;

const routes = (router: ConnectRouter) =>
  router
    .service(Provider, {
      async importResourceState(req, ctx) {
        return hashicupsProvider.importResourceState(req, ctx);
      },
      async configureProvider(req, ctx) {
        return hashicupsProvider.configureProvider(req, ctx);
      },
      async readDataSource(req, ctx) {
        return hashicupsProvider.readDataSource(req, ctx);
      },
      validateProviderConfig(req, ctx) {
        return hashicupsProvider.validateProviderConfig(req, ctx);
      },
      validateDataResourceConfig(req, ctx) {
        return hashicupsProvider.validateDataResourceConfig(req, ctx);
      },
      validateResourceConfig(req, ctx) {
        return hashicupsProvider.validateResourceConfig(req, ctx);
      },
      planResourceChange(req, ctx) {
        return hashicupsProvider.planResourceChange(req, ctx);
      },
      applyResourceChange(req, ctx) {
        return hashicupsProvider.applyResourceChange(req, ctx);
      },
      upgradeResourceState(req) {
        return hashicupsProvider.upgradeResourceState(req);
      },
      async readResource(req, ctx) {
        return hashicupsProvider.readResource(req, ctx);
      },
      getProviderSchema(_req) {
        return hashicupsProvider.getProviderSchema();
      },
    })
    .service(GRPCController, {
      shutdown() {
        console.error("[ERROR] Shutdown", providerInstanceId);
        console.error("[ERROR]");
        process.exit(0);
      },
    })
    .service(Health, {
      check(_req) {
        return {
          status: HealthCheckResponse_ServingStatus.SERVING,
          stdio: HealthCheckResponse_ServingStatus.SERVING,
        };
      },
    })
    .service(GRPCStdio, {
      async *streamStdio(_req) {},
    });

if (
  process.env.TF_PLUGIN_MAGIC_COOKIE !==
  "d602bf8f470bc67ca7faa0386276bbdd4330efaf76d1a219cb4d6991ca9872b2"
) {
  console.error(
    "This binary is a plugin. These are not meant to be executed directly.\nPlease execute the program that consumes these plugins, which will\nload any plugins automatically",
  );
  process.exit(1);
}

if (process.env.PLUGIN_CLIENT_CERT == null) {
  throw new Error("No plugin client cert provided");
}

const { cert: serverCertificate, keys } = generateIdentity();
const cert = forge.pki.certificateToPem(serverCertificate);
const key = forge.pki.privateKeyToPem(keys.privateKey);

const serverCertificateString = forge.util
  .encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(serverCertificate)).getBytes(),
  )
  // Remove padding
  .replace(/=*$/, "");

const PORT = 4001;
http
  .createSecureServer({ cert, key }, connectNodeAdapter({ routes }))
  .listen(PORT);
console.log(`1|6|tcp|127.0.0.1:${PORT}|grpc|${serverCertificateString}`);

process.on("uncaughtException", (error) => console.error(error));
process.on("unhandledRejection", (error) => console.error(error));
