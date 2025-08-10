import { Effect } from "effect";
import { schema, tf, withDescription } from "./attributes.js";
import { provider } from "./provider.js";
import { HashiCupsApiClient } from "./HashiCupsApiClient.js";
import { Diagnostic_Severity } from "../gen/tfplugin6/tfplugin6.7_pb.js";
import { encode } from "./codec.js";

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
  name: "hashicups",
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

  validate(config) {
    return Effect.promise(async () => {
      if (!config.host.startsWith("https://")) {
        return {
          diagnostics: [
            // {
            //   severity: Diagnostic_Severity.WARNING,
            //   summary: "Unsafe protocol",
            //   detail:
            //     "You are using an unsafe protocol. It will be better if you would set this to https://",
            //   attribute: {
            //     steps: [
            //       { selector: { case: "attributeName", value: "host" } },
            //     ],
            //   },
            // },
          ],
        };
      }
      return {};
    });
  },

  datasources: {
    hashicups_coffees: {
      schema: providerSchema.dataSourceSchemas.hashicups_coffees,
      validate() {
        return Effect.sync(() => ({}));
      },
      read(_config, client) {
        return Effect.promise(async () => {
          return {
            state: {
              msgpack: encode({
                coffees: await client.coffees(),
              }),
            },
          };
        });
      },
    },
    hashicups_order: {
      schema: providerSchema.dataSourceSchemas.hashicups_order,
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
    },
  },
});
