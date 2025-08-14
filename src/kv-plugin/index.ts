#!/usr/bin/env bun

import { KV } from "./gen/proto/kv_connect.js";
import { servePlugin } from "../hashicorp-plugin/servePlugin.js";

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
