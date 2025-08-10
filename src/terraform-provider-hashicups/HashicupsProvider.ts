import { hashicupsProviderBuilder } from "./builder.js";
import { hashicupsOrder } from "./resources/hashicupsOrder.js";
import { hashicupsCoffeesDataSource } from "./datasources/coffees.js";
import { hashicupsOrderDataSource } from "./datasources/order.js";

export const hashicupsProvider = hashicupsProviderBuilder.build({
  datasources: {
    hashicups_coffees: hashicupsCoffeesDataSource,
    hashicups_order: hashicupsOrderDataSource,
  },
  resources: {
    hashicups_order: hashicupsOrder,
  },
});
