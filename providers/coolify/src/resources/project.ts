import { Diagnostics, schema, tf } from "@entropitor/terraform-provider-sdk";
import { Effect } from "effect";

import { coolifyProviderBuilder } from "../builder.js";
import { effectify } from "../effectify.js";

export const coolifyProject = coolifyProviderBuilder.resource({
  schema: schema({
    uuid: tf.alwaysComputed.string(),
    name: tf.required.string(),
    description: tf.optional.string(),
  }),

  read({ savedState }, client) {
    return effectify(() =>
      client.GET("/projects/{uuid}", {
        params: { path: { uuid: savedState.uuid } },
      }),
    ).pipe(
      Effect.map((project) => ({ currentState: project })),
      Effect.catchTag("RequestError", ({ response, error }) => {
        if (response.status == 404) {
          return Effect.succeed({ currentState: null });
        }

        return Diagnostics.crit([], `Failed to read project: ${error.message}`);
      }),
    );
  },

  create({ config }, client) {
    return Effect.gen(function* () {
      const project = yield* effectify(() =>
        client.POST("/projects", {
          body: {
            name: config.name,
            description: config.description,
          },
        }),
      ).pipe(
        Effect.catchTag("RequestError", ({ error }) =>
          Diagnostics.crit([], `Failed to create project: ${error.message}`),
        ),
      );
      return {
        newState: {
          ...config,
          ...project,
        },
      };
    });
  },

  update({ config, priorState }, client) {
    return Effect.gen(function* () {
      const project = yield* effectify(() =>
        client.PATCH("/projects/{uuid}", {
          params: { path: { uuid: priorState.uuid } },
          body: {
            name: config.name,
            description: config.description,
          },
        }),
      ).pipe(
        Effect.catchTag("RequestError", ({ error }) =>
          Diagnostics.crit([], `Failed to update project: ${error.message}`),
        ),
      );

      return {
        newState: project,
      };
    });
  },

  delete({ priorState }, client) {
    return Effect.gen(function* () {
      yield* effectify(() =>
        client.DELETE("/projects/{uuid}", {
          params: { path: { uuid: priorState.uuid } },
        }),
      ).pipe(
        Effect.catchTag("RequestError", ({ error }) =>
          Diagnostics.crit([], `Failed to delete project: ${error.message}`),
        ),
      );
    });
  },

  import({ resourceId }, client) {
    return Effect.gen(function* () {
      const project = yield* effectify(() =>
        client.GET("/projects/{uuid}", {
          params: { path: { uuid: resourceId } },
        }),
      ).pipe(
        Effect.catchTag("RequestError", ({ error }) =>
          Diagnostics.crit([], `Failed to import project: ${error.message}`),
        ),
      );

      return {
        currentState: project,
      };
    });
  },
});
