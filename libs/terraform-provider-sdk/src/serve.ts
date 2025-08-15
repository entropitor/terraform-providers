import type { ConnectRouter, ServiceImpl } from "@connectrpc/connect";

import { Provider } from "./gen/tfplugin6/tfplugin6.7_connect.js";
import { servePlugin } from "@entropitor/hashicorp-plugin";

type BuiltProvider = Partial<ServiceImpl<typeof Provider>>;

export const serveProvider = (provider: BuiltProvider) => {
  servePlugin({
    setupRouter: (router: ConnectRouter) => router.service(Provider, provider),
    magicCookie: {
      name: "TF_PLUGIN_MAGIC_COOKIE",
      value: "d602bf8f470bc67ca7faa0386276bbdd4330efaf76d1a219cb4d6991ca9872b2",
    },
    apiProtocolVersion: 6,
    mtls: true,
  });
};
