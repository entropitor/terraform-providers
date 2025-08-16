import { hashicupsProviderBuilder } from "./builder.js";
import { hashicupsCoffeesDataSource } from "./datasources/coffees.js";
import { hashicupsOrderDataSource } from "./datasources/order.js";
import { hashicupsOrder } from "./resources/hashicupsOrder.js";

hashicupsProviderBuilder.serve({
  datasources: {
    hashicups_coffees: hashicupsCoffeesDataSource,
    hashicups_order: hashicupsOrderDataSource,
  },
  resources: {
    hashicups_order: hashicupsOrder,
  },
});
