import {
  schema,
  tf,
  withDescription,
} from "@entropitor/terraform-provider-sdk";
import { Effect } from "effect";

import { hashicupsProviderBuilder } from "../builder.js";

import { coffeeAttributes } from "./coffeeAttributes.js";

export const hashicupsCoffeesDataSource = hashicupsProviderBuilder.datasource({
  schema: schema({
    coffees: tf.computed
      .list(coffeeAttributes)
      .pipe(withDescription("The list of coffees")),
  }).pipe(withDescription("All the coffees our coffee shop has")),

  read(_, client) {
    return Effect.promise(async () => {
      return {
        state: await client.coffees(),
      };
    });
  },
});
