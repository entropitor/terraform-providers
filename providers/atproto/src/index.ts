import { atprotoProviderBuilder } from "./builder.js";
import { atprotoIdentityDataSource } from "./datasources/data_identity.js";
import { atprotoRecordResource } from "./resources/record.js";

atprotoProviderBuilder.serve({
  name: "atproto",
  datasources: {
    identity: atprotoIdentityDataSource,
  },
  resources: {
    record: atprotoRecordResource,
  },
});
