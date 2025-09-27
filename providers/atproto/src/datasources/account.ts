import {
  diagnosticsPath,
  schema,
  tf,
  withDescription,
} from "@entropitor/terraform-provider-sdk";
import { DiagnosticError } from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../builder.js";
import { handleAttribute, messageFrom } from "../utils.js";

export const accountDataSource = atprotoProviderBuilder.datasource({
  schema: schema({
    handle: tf.required
      .custom(handleAttribute)
      .pipe(withDescription("The handle to look up")),
    did: tf.computed
      .string()
      .pipe(withDescription("The resolved DID of this handle")),
  }),

  read({ config }, client) {
    return Effect.gen(function* () {
      const did = yield* Effect.tryPromise({
        try: (signal) =>
          client.handleResolver.resolve(config.handle, { signal }),
        catch: (error) =>
          DiagnosticError.from(
            [diagnosticsPath.attribute("handle")],
            "Could not resolve handle to DID: ",
            messageFrom(error),
          ),
      });

      return {
        state: {
          did,
          handle: config.handle,
        },
      };
    });
  },
});
