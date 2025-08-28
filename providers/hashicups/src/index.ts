import { hashicupsProviderBuilder } from "./builder.js";
import { hashicupsCoffeesDataSource } from "./datasources/coffees.js";
import { hashicupsOrderDataSource } from "./datasources/order.js";
import { hashicupsOrder } from "./resources/hashicupsOrder.js";

hashicupsProviderBuilder.serve({
  name: "hashicups",
  datasources: {
    coffees: hashicupsCoffeesDataSource,
    order: hashicupsOrderDataSource,
  },
  resources: {
    order: hashicupsOrder,
  },
});
