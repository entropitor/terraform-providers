import type { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import http from "node:http2";
import forge from "node-forge";

import { Health } from "./gen/grpc/health/v1/health_connect.js";
import { HealthCheckResponse_ServingStatus } from "./gen/grpc/health/v1/health_pb.js";
import { GRPCStdio } from "./gen/plugin/grpc_stdio_connect.js";
import { Provider } from "./gen/tfplugin6/tfplugin6.7_connect.js";
import { generateIdentity } from "./certificate.js";
import { GRPCController } from "./gen/plugin/grpc_controller_connect.js";

const routes = (router: ConnectRouter) =>
  router
    .service(Provider, {
      getProviderSchema(_req) {
        return {
          provider: {
            block: {},
          },
        };
      },
    })
    .service(GRPCController, {
      shutdown() {
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
