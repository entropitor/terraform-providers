import { tf } from "@entropitor/terraform-provider-sdk";

import { createRecordResource } from "../recordResourceFactory.js";

export const knot = createRecordResource({
  collection: "sh.tangled.knot",
  schema: {
    createdAt: tf.computedIfNotGiven.string(),
  },
  recordToState: (record) => record,
  recordForCreation: (config) => ({
    createdAt: config.createdAt ?? new Date().toISOString(),
  }),
  recordForUpdate: (config, prior) => ({
    createdAt: config.createdAt ?? prior.createdAt,
  }),
});
