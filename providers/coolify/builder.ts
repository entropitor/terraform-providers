import { Effect } from "effect";
import { schema, tf } from "../../libs/provider-sdk/attributes.js";
import { providerBuilder } from "../../libs/provider-sdk/provider.js";
import {
  Diagnostics,
  diagnosticsPath,
} from "../../libs/provider-sdk/diagnostics.js";
import createClient from "openapi-fetch";
import type { paths } from "./gen/coolify-api-schema.js";

export const coolifyProviderBuilder = providerBuilder({
  name: "coolify",
  schema: schema({
    base_url: tf.required.string(),
    token: tf.required.string(),
  }),

  configure({ config }) {
    return Effect.gen(function* () {
      const client = createClient<paths>({
        baseUrl: config.base_url + "/api/v1",
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      });
      try {
        return {
          $state: client,
        };
      } catch (error: any) {
        return yield* Diagnostics.crit(
          [diagnosticsPath.attribute("token")],
          "Invalid credentials",
        );
      }
    });
  },

  validate({ config }) {
    return Effect.gen(function* () {
      if (!config.base_url.startsWith("http")) {
        yield* Diagnostics.crit(
          [diagnosticsPath.attribute("base_url")],
          "Prefix with http(s)://",
          "You should prefix the base URL with http:// or https://",
        );
      }
      if (!config.base_url.startsWith("https://")) {
        yield* Diagnostics.warn(
          [diagnosticsPath.attribute("base_url")],
          "Unsafe protocol",
          "You are using an unsafe protocol. It will be better if you would set this to https://",
        );
      }
      if (config.base_url.includes("/api") || config.base_url.includes("/v1")) {
        yield* Diagnostics.warn(
          [diagnosticsPath.attribute("base_url")],
          "Don't include /api/v1 in the base URL",
          "The base url should not include /api or /v1. It will be added automatically.",
        );
      }
    });
  },
});
