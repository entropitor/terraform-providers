import { camelToSnake } from "effect/String";

import { atprotoProviderBuilder } from "./builder.js";
import { accountDataSource } from "./datasources/account.js";
import { atprotoIdentityDataSource } from "./datasources/data_identity.js";
import { atprotoRecordResource } from "./resources/record.js";
import { atprotoStatusphereStatusResource } from "./resources/statusphere/status.js";
import { tangledResources } from "./resources/tangled/all.js";

atprotoProviderBuilder.serve({
  name: "atproto",
  datasources: {
    identity: atprotoIdentityDataSource,
    account: accountDataSource,
  },
  resources: {
    record: atprotoRecordResource,
    statusphere_status: atprotoStatusphereStatusResource,
    ...Object.fromEntries(
      Object.entries(tangledResources).map(
        ([name, resource]) =>
          [`tangled_${camelToSnake(name)}`, resource] as const,
      ),
    ),
  },
});
