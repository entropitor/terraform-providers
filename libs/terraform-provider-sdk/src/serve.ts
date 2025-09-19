import type { ConnectRouter, ServiceImpl } from "@connectrpc/connect";
import { servePlugin } from "@entropitor/hashicorp-plugin";

import { Provider } from "./gen/tfplugin6/tfplugin6.7_pb.js";

type BuiltProvider = Partial<ServiceImpl<typeof Provider>>;

export const serveProvider = (provider: BuiltProvider) => {
  const providerInstanceId = Math.floor(Math.random() * 1000);

  servePlugin({
    setupRouter: (router: ConnectRouter) => router.service(Provider, provider),
    magicCookie: {
      name: "TF_PLUGIN_MAGIC_COOKIE",
      value: "d602bf8f470bc67ca7faa0386276bbdd4330efaf76d1a219cb4d6991ca9872b2",
    },
    apiProtocolVersion: 6,
    mtls: true,
    interceptors: [
      (next) => async (req) => {
        console.error(
          `[INFO] Request to ${req.method.name} ${providerInstanceId}`,
        );
        try {
          return await next(req);
        } catch (error) {
          console.error(
            `[ERROR] Unhandled error during ${req.method.name}`,
            error,
          );
          throw error;
        }
      },
    ],
  });
};
