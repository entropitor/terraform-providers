import type { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import http from "node:http2";

import { KV } from "./gen/proto/kv_connect.js";
import { Health } from "./gen/grpc/health/v1/health_connect.js";
import { HealthCheckResponse_ServingStatus } from "./gen/grpc/health/v1/health_pb.js";
import { GRPCStdio } from "./gen/plugin/grpc_stdio_connect.js";
import { StdioData_Channel } from "./gen/plugin/grpc_stdio_pb.js";

const routes = (router: ConnectRouter) =>
  router
    .service(KV, {
      get(req) {
        return { value: Buffer.from(`hardcoded value for ${req.key}`) };
      },
    })
    .service(Health, {
      check(_req) {
        return {
          status: HealthCheckResponse_ServingStatus.SERVING,
        };
      },
    })
    .service(GRPCStdio, {
      async *streamStdio(_req) {
        yield {
          data: Buffer.from("Hello from the plugin"),
          channel: StdioData_Channel.STDOUT,
        };
      },
    });

if (process.env.BASIC_PLUGIN !== "hello") {
  console.error(
    "This binary is a plugin. These are not meant to be executed directly.\nPlease execute the program that consumes these plugins, which will\nload any plugins automatically",
  );
  process.exit(1);
}

const server = http
  .createServer(connectNodeAdapter({ routes }))
  .listen(0, () => {
    const address = server.address();
    if (typeof address === "string" || address == null) {
      throw new Error(`unexpected string address ${address}`);
    }
    console.log(`1|1|tcp|127.0.0.1:${address.port}|grpc`);
  });
server.on("session", (session) => {
  session.socket.on("close", () => {
    server.close();
  });
});

process.on("SIGTERM", () => {
  server.close();
});
