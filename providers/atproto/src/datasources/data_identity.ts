import { schema, tf } from "@entropitor/terraform-provider-sdk";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../builder.js";

export const atprotoIdentityDataSource = atprotoProviderBuilder.datasource({
  schema: schema({
    did: tf.computed.string(),
  }),

  read(_, client) {
    return Effect.succeed({
      state: {
        did: client.session.did,
      },
    });
  },
});
