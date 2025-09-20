import {
  schema,
  tf,
  withDescription,
} from "@entropitor/terraform-provider-sdk";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../builder.js";
import { handleAttribute } from "../utils.js";

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
      const did = yield* Effect.promise((signal) =>
        client.handleResolver.resolve(config.handle, { signal }),
      );

      return {
        state: {
          did,
          handle: config.handle,
        },
      };
    });
  },
});
