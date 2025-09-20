import { tf } from "@entropitor/terraform-provider-sdk";

import { createRecordResource } from "../recordResourceFactory.js";

export const profile = createRecordResource({
  collection: "sh.tangled.actor.profile",
  schema: {
    bluesky: tf.required.boolean(),

    description: tf.optional.string(),
    location: tf.optional.string(),
  },
  recordToState: (record) => record,
  recordForCreation: (config) => ({
    ...config,
    description: config.description ?? undefined,
    location: config.location ?? undefined,
  }),
  recordForUpdate: (config) => ({
    ...config,
    description: config.description ?? undefined,
    location: config.location ?? undefined,
  }),
});
