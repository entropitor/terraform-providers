import { Effect } from "effect";
import { schema, tf, withDescription } from "../attributes.js";
import { providerBuilder } from "../provider.js";
import { HashiCupsApiClient } from "./HashiCupsApiClient.js";
import { Diagnostic_Severity } from "../../gen/tfplugin6/tfplugin6.7_pb.js";
import { encode, Unknown } from "../codec.js";

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

const hashicupsProviderBuilder = providerBuilder({
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
});

const hashicupsCoffeesDataSource = hashicupsProviderBuilder.datasource({
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
});

const hashicupsOrderDataSource = hashicupsProviderBuilder.datasource({
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
});

const hashicupsOrder = hashicupsProviderBuilder.resource({
  schema: providerSchema.resourceSchemas.hashicups_order,
  validate() {
    return Effect.sync(() => ({}));
  },

  plan(
    { proposedNewState, priorState, proposedNewStateIsPriorState },
    _client,
  ) {
    return Effect.promise(async () => {
      if (!proposedNewStateIsPriorState) {
        // @ts-expect-error not able to assign Unknown to number
        proposedNewState.id = new Unknown();
        // @ts-expect-error not able to assign Unknown to number
        proposedNewState.last_updated = new Unknown();
        proposedNewState.items.forEach((item: any) => {
          item.coffee.collection = new Unknown();
          item.coffee.color = new Unknown();
          item.coffee.description = new Unknown();
          item.coffee.image = new Unknown();
          item.coffee.ingredients = new Unknown();
          item.coffee.name = new Unknown();
          item.coffee.origin = new Unknown();
          item.coffee.price = new Unknown();
          item.coffee.teaser = new Unknown();
        });
      }

      if (priorState?.id) {
        proposedNewState.id = priorState.id;
      }
      proposedNewState.items.forEach((item: any, index: number) => {
        const priorItem = priorState?.items?.[index];
        if (item.coffee?.id === priorItem?.coffee?.id) {
          item.coffee = priorItem?.coffee;
        }
      });

      return {
        plannedState: { msgpack: encode(proposedNewState) },
      };
    });
  },

  apply({ config, priorState: prior }, client) {
    return Effect.promise(async () => {
      if (prior == null) {
        const order = await client.createOrder(config.items);
        return {
          newState: {
            msgpack: encode({
              ...order,
              last_updated: new Date().toISOString(),
            }),
          },
        };
      } else if (config != null) {
        await client.updateOrder(prior.id, config.items);
        const order = await client.getOrder(prior.id);
        return {
          newState: {
            msgpack: encode({
              ...order,
              last_updated: new Date().toISOString(),
            }),
          },
        };
      } else {
        await client.deleteOrder(prior.id);
        return {
          newState: { msgpack: encode(null) },
        };
      }
    });
  },
});

export const hashicupsProvider = hashicupsProviderBuilder.build({
  datasources: {
    hashicups_coffees: hashicupsCoffeesDataSource,
    hashicups_order: hashicupsOrderDataSource,
  },
  resources: {
    hashicups_order: hashicupsOrder,
  },
});
