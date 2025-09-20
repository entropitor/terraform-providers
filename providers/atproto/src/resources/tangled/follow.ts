import { tf } from "@entropitor/terraform-provider-sdk";

import { didStringAttribute } from "../../utils.js";
import { createRecordResource } from "../recordResourceFactory.js";

export const follow = createRecordResource({
  collection: "sh.tangled.graph.follow",
  schema: {
    createdAt: tf.computedIfNotGiven.string(),
    subject: tf.required.custom(didStringAttribute),
  },
  recordToState: (record) => record,
  recordForCreation: (config) => ({
    ...config,
    createdAt: config.createdAt ?? new Date().toISOString(),
  }),
  recordForUpdate: (config, prior) => ({
    ...config,
    createdAt: config.createdAt ?? prior.createdAt,
  }),
});
