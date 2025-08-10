import { Effect } from "effect";
import { schema, tf, withDescription } from "./attributes.js";
import { provider } from "./provider.js";
import { HashiCupsApiClient } from "./HashiCupsApiClient.js";
import { Diagnostic_Severity } from "../gen/tfplugin6/tfplugin6.7_pb.js";

const coffeeAttributes = {
  collection: tf.computed.string(),
  color: tf.computed.string(),
  description: tf.computed.string(),
  id: tf.computed.number(),
  image: tf.computed.string(),
  ingredients: tf.computed.list({
    ingredient_id: tf.computed.number(),
  }),
  name: tf.computed.string(),
  origin: tf.computed.string(),
  price: tf.computed.number(),
  teaser: tf.computed.string(),
};

export const providerSchema = {
  provider: schema({
    host: tf.optional.string(),
    username: tf.optional.string(),
    password: tf.optional.string(),
  }),
  resourceSchemas: {
    hashicups_order: schema({
      id: tf.computed.number(),
      last_updated: tf.computed.string(),
      items: tf.required.list({
        coffee: tf.required.object({
          id: tf.required.number(),
          collection: tf.computed.string(),
          color: tf.computed.string(),
          description: tf.computed.string(),
          image: tf.computed.string(),
          ingredients: tf.computed.list({
            ingredient_id: tf.computed.number(),
          }),
          name: tf.computed.string(),
          origin: tf.computed.string(),

          price: tf.computed.number(),
          teaser: tf.computed.string(),
        }),
        quantity: tf.required.number(),
      }),
    }),
  },
  dataSourceSchemas: {
    hashicups_coffees: schema({
      coffees: tf.computed
        .list(coffeeAttributes)
        .pipe(withDescription("The list of coffees")),
    }).pipe(withDescription("All the coffees our coffee shop has")),
    hashicups_order: schema({
      id: tf.required.number(),
      items: tf.computed.list({
        coffee: tf.computed.object(coffeeAttributes),
        quantity: tf.computed.number(),
      }),
    }),
  },
};

export const hashicupsProvider = provider({
  schema: providerSchema.provider,

  configure(config) {
    return Effect.promise(async () => {
      try {
        return { $state: await HashiCupsApiClient.signin(config) };
      } catch (error: any) {
        return {
          $state: null! as HashiCupsApiClient,
          diagnostics: [
            {
              detail: error.message,
              summary: "Invalid credentials",
              severity: Diagnostic_Severity.ERROR,
              attribute: {
                steps: [
                  { selector: { case: "attributeName", value: "password" } },
                ],
              },
            },
          ],
        };
      }
    });
  },
});
