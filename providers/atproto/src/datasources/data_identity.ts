import {
  schema,
  tf,
  withDescription,
} from "@entropitor/terraform-provider-sdk";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../builder.js";

export const atprotoIdentityDataSource = atprotoProviderBuilder.datasource({
  schema: schema({
    did: tf.computed
      .string()
      .pipe(withDescription("The DID of the authenticated user")),
  }),

  read(_, client) {
    return Effect.succeed({
      state: {
        did: client.session.did,
      },
    });
  },
});
