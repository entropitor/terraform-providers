import { Effect } from "effect";
import { schema, tf } from "../../provider-sdk/attributes.js";
import { coolifyProviderBuilder } from "../builder.js";
import { Diagnostics } from "../../provider-sdk/diagnostics.js";
import { effectify } from "../effectify.js";

const serverSchema = {
  uuid: tf.computed.string(),
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
    concurrent_builds: tf.computed.number(),
    dynamic_timeout: tf.computed.number(),
    force_disabled: tf.computed.boolean(),
    force_server_cleanup: tf.computed.boolean(),
    is_build_server: tf.computed.boolean(),
    is_cloudflare_tunnel: tf.computed.boolean(),
    is_jump_server: tf.computed.boolean(),
    is_logdrain_axiom_enabled: tf.computed.boolean(),
    is_logdrain_custom_enabled: tf.computed.boolean(),
    is_logdrain_highlight_enabled: tf.computed.boolean(),
    is_logdrain_newrelic_enabled: tf.computed.boolean(),
    is_metrics_enabled: tf.computed.boolean(),
    is_reachable: tf.computed.boolean(),
    is_sentinel_enabled: tf.computed.boolean(),
    is_swarm_manager: tf.computed.boolean(),
    is_swarm_worker: tf.computed.boolean(),
    is_usable: tf.computed.boolean(),
    logdrain_axiom_api_key: tf.computed.string(),
    logdrain_axiom_dataset_name: tf.computed.string(),
    logdrain_custom_config: tf.computed.string(),
    logdrain_custom_config_parser: tf.computed.string(),
    logdrain_highlight_project_id: tf.computed.string(),
    logdrain_newrelic_base_uri: tf.computed.string(),
    logdrain_newrelic_license_key: tf.computed.string(),
    sentinel_metrics_history_days: tf.computed.number(),
    sentinel_metrics_refresh_rate_seconds: tf.computed.number(),
    sentinel_token: tf.computed.string(),
    docker_cleanup_frequency: tf.computed.string(),
    docker_cleanup_threshold: tf.computed.number(),
    server_id: tf.computed.number(),
    wildcard_domain: tf.computed.string(),
    created_at: tf.computed.string(),
    updated_at: tf.computed.string(),
    delete_unused_volumes: tf.computed.boolean(),
    delete_unused_networks: tf.computed.boolean(),
  }),
};
export const coolifyServerDataSource = coolifyProviderBuilder.datasource({
  schema: schema({ ...serverSchema, uuid: tf.required.string() }),

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

export const coolifyServersDataSource = coolifyProviderBuilder.datasource({
  schema: schema({
    servers: tf.computed.list(serverSchema),
  }),

  read(_, client) {
    return effectify(() => client.GET("/servers")).pipe(
      Effect.map((servers) => ({ state: { servers } })),
      Effect.catchTag("RequestError", ({ error }) =>
        Diagnostics.crit([], `Failed to read servers: ${error.message}`),
      ),
    );
  },
});
