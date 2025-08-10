import { Effect } from "effect";
import { schema, tf } from "../../provider-sdk/attributes.js";
import { coolifyProviderBuilder } from "../builder.js";
import { Diagnostics } from "../../provider-sdk/diagnostics.js";
import { effectify } from "../effectify.js";

export const coolifyServerDataSource = coolifyProviderBuilder.datasource({
  schema: schema({
    uuid: tf.required.string(),
    name: tf.computed.string(),
    description: tf.computed.string(),
    ip: tf.computed.string(),
    user: tf.computed.string(),
    port: tf.computed.number(),
    proxy: tf.computed.object({}),
    proxy_type: tf.computed.string(),
    high_disk_usage_notification_sent: tf.computed.boolean(),
    unreachable_notification_sent: tf.computed.boolean(),
    unreachable_count: tf.computed.number(),
    validation_logs: tf.computed.string(),
    swarm_cluster: tf.computed.string(),
    settings: tf.computed.object({
      id: tf.computed.number(),
    }),
  }),

  read({ config }, client) {
    return effectify(() =>
      client.GET("/servers/{uuid}", {
        params: { path: { uuid: config.uuid } },
      }),
    ).pipe(
      Effect.map((server) => ({ state: server })),
      Effect.catchTag("RequestError", ({ error }) =>
        Diagnostics.crit([], `Failed to read server: ${error.message}`),
      ),
    );
  },
});
