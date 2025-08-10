import { Effect } from "effect";
import { schema, tf } from "../../provider-sdk/attributes.js";
import { hashicupsProviderBuilder } from "../builder.js";
import { coffeeAttributes } from "./coffeeAttributes.js";

export const hashicupsOrderDataSource = hashicupsProviderBuilder.datasource({
  schema: schema({
    id: tf.required.number(),
    items: tf.computed.list({
      coffee: tf.computed.object(coffeeAttributes),
      quantity: tf.computed.number(),
    }),
  }),
  validate() {
    return Effect.sync(() => ({}));
  },
  read({ config }, client) {
    return Effect.promise(async () => {
      return {
        state: await client.getOrder(config.id),
      };
    });
  },
});
