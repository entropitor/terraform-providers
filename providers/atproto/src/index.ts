import { atprotoProviderBuilder } from "./builder.js";
import { atprotoIdentityDataSource } from "./datasources/data_identity.js";
import { atprotoRecordResource } from "./resources/record.js";

atprotoProviderBuilder.serve({
  datasources: {
    atproto_identity: atprotoIdentityDataSource,
  },
  resources: {
    atproto_record: atprotoRecordResource,
  },
});
