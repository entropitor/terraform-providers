import { Effect } from "effect";
import { schema, tf } from "../../provider-sdk/attributes.js";
import { hashicupsProviderBuilder } from "../builder.js";
import { Unknown } from "../../provider-sdk/codec.js";

export const hashicupsOrder = hashicupsProviderBuilder.resource({
  schema: schema({
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
      } else {
        proposedNewState.last_updated = priorState?.last_updated;
      }

      proposedNewState.items.forEach((item: any, index: number) => {
        const priorItem = priorState?.items?.[index];
        if (item.coffee?.id === priorItem?.coffee?.id) {
          item.coffee = priorItem?.coffee;
        }
      });

      return { plannedState: proposedNewState };
    });
  },

  read({ savedState }, client) {
    return Effect.promise(() => client.getOrder(savedState.id)).pipe(
      Effect.map((order) => ({ currentState: order })),
    );
  },
  import({ resourceId }, client) {
    return Effect.promise(() => client.getOrder(Number(resourceId))).pipe(
      Effect.map((order) => ({
        currentState: {
          ...order,
          last_updated: null,
        },
      })),
    );
  },

  create({ config }, client) {
    return Effect.gen(function* () {
      const order = yield* Effect.promise(() =>
        client.createOrder(config.items),
      );
      return {
        newState: {
          ...order,
          last_updated: new Date().toISOString(),
        },
      };
    });
  },
  update({ config, priorState: prior }, client) {
    return Effect.promise(async () => {
      await client.updateOrder(prior.id, config.items);
      const order = await client.getOrder(prior.id);
      return {
        newState: {
          ...order,
          last_updated: new Date().toISOString(),
        },
      };
    });
  },
  delete({ priorState: prior }, client) {
    return Effect.promise(async () => {
      await client.deleteOrder(prior.id);
    });
  },
});
