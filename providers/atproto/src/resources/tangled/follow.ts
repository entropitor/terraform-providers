import { tf, withDescription } from "@entropitor/terraform-provider-sdk";

import { didStringAttribute } from "../../utils.js";
import { createRecordResource } from "../recordResourceFactory.js";

export const follow = createRecordResource({
  collection: "sh.tangled.graph.follow",
  schema: {
    createdAt: tf.computedIfNotGiven
      .string()
      .pipe(withDescription("Since when this follow has existed")),
    subject: tf.required
      .custom(didStringAttribute)
      .pipe(withDescription("The DID of the user being followed")),
  },
  description: "Follow another user on Tangled.org",
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
