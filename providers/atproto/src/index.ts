import { atprotoProviderBuilder } from "./builder.js";
import { atprotoIdentityDataSource } from "./datasources/data_identity.js";

atprotoProviderBuilder.serve({
  datasources: {
    atproto_identity: atprotoIdentityDataSource,
  },
  resources: {},
});
