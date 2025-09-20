import { tf, withDescription } from "@entropitor/terraform-provider-sdk";

import { createRecordResource } from "../recordResourceFactory.js";

export const publicKey = createRecordResource({
  collection: "sh.tangled.publicKey",
  schema: {
    key: tf.required.string().pipe(withDescription("The public key contents")),
    name: tf.required
      .string()
      .pipe(withDescription("Human readable name for the key")),
    createdAt: tf.computedIfNotGiven.string(),
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
