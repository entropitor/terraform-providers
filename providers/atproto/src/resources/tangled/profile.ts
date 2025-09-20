import {
  attributeType,
  tf,
  transform,
} from "@entropitor/terraform-provider-sdk";

import { atUrlAttribute, urlAttribute } from "../../utils.js";
import { createRecordResource } from "../recordResourceFactory.js";

export const profile = createRecordResource({
  collection: "sh.tangled.actor.profile",
  rkey: "self",
  schema: {
    bluesky: tf.required.boolean(),

    description: tf.optional.string(),
    location: tf.optional.string(),
    links: tf.optional.array(urlAttribute),
    stats: tf.optional.array(
      transform(
        attributeType.string,
        (value) =>
          value as
            | "closed-issue-count"
            | "closed-pull-request-count"
            | "merged-pull-request-count"
            | "open-issue-count"
            | "open-pull-request-count"
            | "repository-count",
      ),
    ),
    pinnedRepositories: tf.optional.array(atUrlAttribute),
  },
  recordToState: (record) => record,
  recordForCreation: (config) => ({
    ...config,
    description: config.description ?? undefined,
    location: config.location ?? undefined,
    links: config.links ?? undefined,
    stats: config.stats ?? undefined,
    pinnedRepositories: config.pinnedRepositories ?? undefined,
  }),
  recordForUpdate: (config) => ({
    ...config,
    description: config.description ?? undefined,
    location: config.location ?? undefined,
    links: config.links ?? undefined,
    stats: config.stats ?? undefined,
    pinnedRepositories: config.pinnedRepositories ?? undefined,
  }),
});
