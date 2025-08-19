import { Client, CredentialManager } from "@atcute/client";
export type { Client } from "@atcute/client";
import type {} from "@atcute/atproto";
import {
  diagnosticsPath,
  providerBuilder,
  schema,
  tf,
} from "@entropitor/terraform-provider-sdk";
import { DiagnosticError } from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { Effect } from "effect";

const messageFrom = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error occurred";
};

export const atprotoProviderBuilder = providerBuilder({
  name: "atproto",
  schema: schema({
    handle: tf.required.string(),
    app_password: tf.required.string(),
  }),

  configure({ config }) {
    return Effect.gen(function* () {
      const manager = new CredentialManager({
        service: "https://bsky.social",
      });
      const rpc = new Client({ handler: manager });

      const session = yield* Effect.tryPromise({
        try: () =>
          manager.login({
            identifier: config.handle,
            password: config.app_password,
          }),
        catch: (error) =>
          DiagnosticError.from(
            diagnosticsPath.for("app_password"),
            "Invalid credentials",
            messageFrom(error),
          ),
      });

      return { $state: { rpc, session } };
    });
  },
});
