import { atprotoProviderBuilder } from "./builder.js";
import { atprotoIdentityDataSource } from "./datasources/data_identity.js";
import { atprotoRecordResource } from "./resources/record.js";
import { atprotoStatusphereStatusResource } from "./resources/statusphere/status.js";

atprotoProviderBuilder.serve({
  name: "atproto",
  datasources: {
    identity: atprotoIdentityDataSource,
  },
  resources: {
    record: atprotoRecordResource,
    statusphere_status: atprotoStatusphereStatusResource,
  },
});
