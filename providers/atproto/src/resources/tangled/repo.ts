import { tf } from "@entropitor/terraform-provider-sdk";

import { didStringAttribute, urlAttribute } from "../../utils.js";
import { createRecordResource } from "../recordResourceFactory.js";

export const repository = createRecordResource({
  collection: "sh.tangled.repo",
  schema: {
    name: tf.required.string(),
    owner: tf.computedIfNotGiven.custom(didStringAttribute),
    knot: tf.required.string(),
    spindle: tf.optional.string(),
    description: tf.optional.string(),
    source: tf.optional.custom(urlAttribute),
    createdAt: tf.computedIfNotGiven.string(),
  },
  recordToState: (record) => record,
  recordForCreation: (config, client) => ({
    ...config,
    spindle: config.spindle ?? undefined,
    description: config.description ?? undefined,
    source: config.source ?? undefined,
    owner: config.owner ?? client.session.did,
    createdAt: config.createdAt ?? new Date().toISOString(),
  }),
  recordForUpdate: (config, prior, client) => ({
    ...config,
    spindle: config.spindle ?? undefined,
    description: config.description ?? undefined,
    source: config.source ?? undefined,
    owner: config.owner ?? client.session.did,
    createdAt: config.createdAt ?? prior.createdAt,
  }),
});
