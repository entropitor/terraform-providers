import { tf, withDescription } from "@entropitor/terraform-provider-sdk";

import { didStringAttribute } from "../../utils.js";
import { createRecordResource } from "../recordResourceFactory.js";

export const knotMember = createRecordResource({
  collection: "sh.tangled.knot.member",
  schema: {
    subject: tf.required.custom(didStringAttribute),
    domain: tf.required
      .string()
      .pipe(withDescription("domain that this member now belongs to")),
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
