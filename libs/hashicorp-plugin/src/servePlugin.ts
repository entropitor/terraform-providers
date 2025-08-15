import type { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import http2 from "node:http2";
import forge from "node-forge";

import { Health } from "./gen/grpc/health/v1/health_connect.js";
import { HealthCheckResponse_ServingStatus } from "./gen/grpc/health/v1/health_pb.js";
import { GRPCStdio } from "./gen/plugin/grpc_stdio_connect.js";
import { generateIdentity } from "./certificate.js";
import { GRPCController } from "./gen/plugin/grpc_controller_connect.js";
import assert from "node:assert";

export type HashicorpPlugin = {
  magicCookie: null | {
    name: string;
    value: string;
  };
  mtls: boolean;
  apiProtocolVersion: number;
  pluginProtocolVersion?: 1;
  setupRouter: (router: ConnectRouter) => void;
};

export const servePlugin = (plugin: HashicorpPlugin) => {
  if (plugin.magicCookie != null) {
    if (process.env[plugin.magicCookie.name] !== plugin.magicCookie.value) {
      console.error(
        "This binary is a plugin. These are not meant to be executed directly.\nPlease execute the program that consumes these plugins, which will\nload any plugins automatically",
      );
      process.exit(1);
    }
  }

  const routes = (router: ConnectRouter) => {
    router
      .service(GRPCController, {
        shutdown() {
          process.exit(0);
        },
      })
      .service(Health, {
        check() {
          return {
            status: HealthCheckResponse_ServingStatus.SERVING,
            stdio: HealthCheckResponse_ServingStatus.SERVING,
          };
        },
      })
      .service(GRPCStdio, {
        async *streamStdio(_req) {},
      });

    plugin.setupRouter(router);
  };
  const requestHandler = connectNodeAdapter({
    routes,
    connect: false,
    grpcWeb: false,
  });

  let server: http2.Http2Server;
  let serverCertificateString: string | null;

  if (plugin.mtls === false) {
    server = http2.createServer(requestHandler);
  } else {
    const { cert: serverCertificate, keys } = generateIdentity();
    const cert = forge.pki.certificateToPem(serverCertificate);
    const key = forge.pki.privateKeyToPem(keys.privateKey);

    serverCertificateString = forge.util
      .encode64(
        forge.asn1
          .toDer(forge.pki.certificateToAsn1(serverCertificate))
          .getBytes(),
      )
      // Remove padding
      .replace(/=*$/, "");

    const clientCert = process.env.PLUGIN_CLIENT_CERT;
    if (clientCert == null) {
      throw new Error("No plugin client cert provided");
    }
    server = http2.createSecureServer(
      {
        cert,
        key,
        ca: clientCert,
        minVersion: "TLSv1.2",
        // Doesn't work with Terraform for some reason
        // requestCert: true,
        // rejectUnauthorized: true,
        allowHTTP1: false,
      },
      requestHandler,
    );
  }

  server.listen(0, () => {
    const info = server.address();
    assert(info != null && typeof info == "object");

    const handshake = [
      1,
      plugin.apiProtocolVersion,
      "tcp",
      `127.0.0.1:${info.port}`,
      "grpc",
    ];
    if (serverCertificateString != null) {
      handshake.push(serverCertificateString);
    }

    console.log(handshake.join("|"));
  });

  process.on("uncaughtException", (error) => console.error(error));
  process.on("unhandledRejection", (error) => console.error(error));
};
