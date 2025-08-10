import { Effect } from "effect";
import { Diagnostic_Severity } from "../../gen/tfplugin6/tfplugin6.7_pb.js";
import { schema, tf } from "../../provider-sdk/attributes.js";
import { hashicupsProviderBuilder } from "../builder.js";
import { coffeeAttributes } from "./coffeeAttributes.js";
import { encode } from "../../provider-sdk/codec.js";

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
  read(config, client) {
    return Effect.promise(async () => {
      try {
        return {
          state: {
            msgpack: encode(await client.getOrder(config.id)),
          },
        };
      } catch (error: any) {
        return {
          diagnostics: [
            {
              detail: error.message,
              summary: "Error while reading resource",
              severity: Diagnostic_Severity.ERROR,
            },
          ],
        };
      }
    });
  },
});
