import { Effect } from "effect";
import { schema, tf } from "../../provider-sdk/attributes.js";
import { coolifyProviderBuilder } from "../builder.js";
import { Diagnostics } from "../../provider-sdk/diagnostics.js";

export const coolifyProject = coolifyProviderBuilder.resource({
  schema: schema({
    uuid: tf.computed.string(),
    name: tf.required.string(),
    description: tf.optional.string(),
  }),

  read({ savedState }, client) {
    return Effect.gen(function* () {
      const project = yield* Effect.promise(() =>
        client.GET("/projects/{uuid}", {
          params: { path: { uuid: savedState.uuid } },
        }),
      );
      if (project.response.status == 404) {
        return { currentState: null };
      }
      if (!project.response.ok || project.data == null) {
        return yield* Diagnostics.crit([], "Failed to read project");
      }
      return {
        currentState: project.data,
      };
    });
  },

  create({ config }, client) {
    return Effect.gen(function* () {
      const project = yield* Effect.promise(() =>
        client.POST("/projects", {
          body: {
            name: config.name,
            description: config.description,
          },
        }),
      );
      if (!project.response.ok || project.data == null) {
        return yield* Diagnostics.crit([], "Failed to create project");
      }
      return {
        newState: {
          ...config,
          ...project.data,
        },
      };
    });
  },

  update({ config, priorState }, client) {
    return Effect.gen(function* () {
      const project = yield* Effect.promise(() =>
        client.PATCH("/projects/{uuid}", {
          params: { path: { uuid: priorState.uuid } },
          body: {
            name: config.name,
            description: config.description,
          },
        }),
      );
      if (!project.response.ok || project.data == null) {
        return yield* Diagnostics.crit([], "Failed to update project");
      }
      return {
        newState: project.data,
      };
    });
  },

  delete({ priorState }, client) {
    return Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        client.DELETE("/projects/{uuid}", {
          params: { path: { uuid: priorState.uuid } },
        }),
      );
      if (!response.response.ok) {
        return yield* Diagnostics.crit([], "Failed to delete project");
      }
      return {};
    });
  },

  import({ resourceId }, client) {
    return Effect.gen(function* () {
      const project = yield* Effect.promise(() =>
        client.GET("/projects/{uuid}", {
          params: { path: { uuid: resourceId } },
        }),
      );
      if (!project.response.ok || project.data == null) {
        return yield* Diagnostics.crit([], "Failed to import project");
      }
      return {
        currentState: project.data,
      };
    });
  },
});
