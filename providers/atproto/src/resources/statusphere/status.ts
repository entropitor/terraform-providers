import { tf } from "@entropitor/terraform-provider-sdk";

import { createRecordResource } from "../recordResourceFactory.js";

declare module "@atcute/lexicons/ambient" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Records {
    ["xyz.statusphere.status"]: {
      status: string;
      createdAt: string;
    };
  }
}

export const atprotoStatusphereStatusResource = createRecordResource({
  collection: "xyz.statusphere.status",
  schema: {
    status: tf.required.string(),
    createdAt: tf.computedIfNotGiven.string(),
  },
  recordToState: (record) => ({
    status: record.status,
    createdAt: record.createdAt,
  }),
  recordForCreation: (config) => ({
    status: config.status,
    createdAt: config.createdAt ?? new Date().toISOString(),
  }),
  recordForUpdate: (config, prior) => ({
    status: config.status,
    createdAt: config.createdAt ?? prior.createdAt,
  }),
});
