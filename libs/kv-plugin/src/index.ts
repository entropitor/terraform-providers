#!/usr/bin/env bun

import { servePlugin } from "@entropitor/hashicorp-plugin";

import { KV } from "./gen/proto/kv_pb.js";

servePlugin({
  magicCookie: {
    name: "BASIC_PLUGIN",
    value: "hello",
  },
  mtls: false,
  apiProtocolVersion: 1,
  setupRouter: (router) =>
    router.service(KV, {
      get(req) {
        return { value: Buffer.from(`hardcoded value for ${req.key}`) };
      },
    }),
});
