import { Effect } from "effect";
import { schema, tf } from "../../provider-sdk/attributes.js";
import { coolifyProviderBuilder } from "../builder.js";
import { Diagnostics } from "../../provider-sdk/diagnostics.js";
import { effectify } from "../effectify.js";

export const coolifyService = coolifyProviderBuilder.resource({
  schema: schema({
    uuid: tf.computed.string(),
    type: tf.optional.string(), // requires replace
    name: tf.required.string(),
    description: tf.optional.string(),
    project_uuid: tf.required.string(),
    environment: tf.union(
      { environment_name: tf.required.string() },
      { environment_uuid: tf.required.string() },
    ),
    server_uuid: tf.required.string(),
    destination_uuid: tf.optional.string(),
    instant_deploy: tf.optional.boolean(),
    // docker_compose_raw: tf.optional.string(), optional-computed
  }),

  read({ savedState }, client) {
    return effectify(() =>
      client.GET("/services/{uuid}", {
        params: { path: { uuid: savedState.uuid } },
      }),
    ).pipe(
      Effect.map((service) => ({
        currentState: {
          ...savedState,
          service,
        },
      })),
      Effect.catchTag("RequestError", ({ response, error }) => {
        if (response.status == 404) {
          return Effect.succeed({ currentState: null });
        }

        return Diagnostics.crit([], `Failed to read service: ${error.message}`);
      }),
    );
  },

  create({ config }, client) {
    return Effect.gen(function* () {
      const service = yield* effectify(() =>
        client.POST("/services", {
          body: {
            ...config,
            type: config.type as any,
            uuid: undefined,
          },
        }),
      ).pipe(
        Effect.catchTag("RequestError", ({ error }) =>
          Diagnostics.crit([], `Failed to create service: ${error.message}`),
        ),
      );
      return {
        newState: {
          ...config,
          ...service,
        },
      };
    });
  },

  update() {
    // update({ config, priorState }, client) {
    throw new Error("Not implemented");
    // return Effect.gen(function* () {
    //   const service = yield* effectify(() =>
    //     client.PATCH("/services/{uuid}", {
    //       params: { path: { uuid: priorState.uuid } },
    //       body: {
    //         ...config,
    //         docker_compose_raw: priorState.docker_compose_raw,
    //       },
    //     }),
    //   ).pipe(
    //     Effect.catchTag("RequestError", ({ error }) =>
    //       Diagnostics.crit([], `Failed to update service: ${error.message}`),
    //     ),
    //   );

    //   return {
    //     newState: service,
    //   };
    // });
  },

  delete({ priorState }, client) {
    return Effect.gen(function* () {
      yield* effectify(() =>
        client.DELETE("/services/{uuid}", {
          params: { path: { uuid: priorState.uuid } },
        }),
      ).pipe(
        Effect.catchTag("RequestError", ({ error }) =>
          Diagnostics.crit([], `Failed to delete service: ${error.message}`),
        ),
      );
    });
  },

  import({ resourceId }, client) {
    return Effect.gen(function* () {
      const REGEX =
        /server\/(?<server_uuid>.*)\/project\/(?<project_uuid>.*)\/environment\/(?<environment_uuid>.*)\/service\/(?<service_uuid>.*)/;
      const match = resourceId.match(REGEX);
      if (match == null) {
        return yield* Diagnostics.crit(
          [],
          "Invalid resource ID format for service import",
          'Use the format "server/{server_uuid}/project/{project_uuid}/environment/{environment_uuid}/service/{service_uuid}"',
        );
      }

      const service = yield* effectify(() =>
        client.GET("/services/{uuid}", {
          params: { path: { uuid: match.groups!["service_uuid"]! } },
        }),
      ).pipe(
        Effect.catchTag("RequestError", ({ error }) =>
          Diagnostics.crit([], `Failed to import service: ${error.message}`),
        ),
      );

      return {
        currentState: {
          type: undefined,
          project_uuid: match.groups!["project_uuid"]!,
          environment_uuid: match.groups!["environment_uuid"]!,
          server_uuid: match.groups!["server_uuid"]!,
          ...service,
        },
      };
    });
  },
});
