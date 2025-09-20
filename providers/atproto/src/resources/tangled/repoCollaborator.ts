import { tf } from "@entropitor/terraform-provider-sdk";

import { atUrlAttribute, didStringAttribute } from "../../utils.js";
import { createRecordResource } from "../recordResourceFactory.js";

export const repositoryCollaborator = createRecordResource({
  collection: "sh.tangled.repo.collaborator",
  schema: {
    subject: tf.required.custom(didStringAttribute),
    repo: tf.required.custom(atUrlAttribute),
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
