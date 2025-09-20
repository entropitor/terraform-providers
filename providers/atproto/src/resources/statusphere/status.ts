import {
  requiresReplacementOnChange,
  schema,
  tf,
  Unknown,
} from "@entropitor/terraform-provider-sdk";
import { Diagnostics } from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../../builder.js";

const collection = "xyz.statusphere.status";
declare module "@atcute/lexicons/ambient" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Records {
    ["xyz.statusphere.status"]: {
      status: string;
      createdAt: string;
    };
  }
}

export const atprotoStatusphereStatusResource = atprotoProviderBuilder.resource(
  {
    schema: schema({
      rkey: tf.computedIfNotGiven.string().pipe(requiresReplacementOnChange()),
      cid: tf.alwaysComputed.string(),

      status: tf.required.string(),
      createdAt: tf.computedIfNotGiven.string(),
    }),

    read({ savedState }, client) {
      return Effect.gen(function* () {
        const { cid, record } = yield* client.records.get({
          collection,
          rkey: savedState.rkey,
        });

        return {
          currentState: {
            ...savedState,
            ...record,
            cid,
          },
        };
      });
    },

    import({ resourceId: rkey }, client) {
      return Effect.gen(function* () {
        const { cid, record } = yield* client.records
          .get({
            collection,
            rkey,
          })
          .pipe(
            Effect.catchTag("RemoteResourceNotFound", () =>
              Diagnostics.crit([], "Record not found"),
            ),
          );

        return {
          currentState: {
            rkey,
            collection,
            cid,
            status: record.status,
            createdAt: record.createdAt,
          },
        };
      });
    },

    plan({ proposedNewState, proposedNewStateIsPriorState }) {
      // eslint-disable-next-line require-yield
      return Effect.gen(function* () {
        if (!proposedNewStateIsPriorState) {
          // @ts-expect-error: We don't yet support unknown types in proposed state
          proposedNewState.cid = new Unknown();
        }

        return {
          plannedState: proposedNewState,
        };
      });
    },

    create({ config }, client) {
      return Effect.gen(function* () {
        const record = {
          status: config.status,
          createdAt: config.createdAt ?? new Date().toISOString(),
        } as const;

        const { rkey, cid } = yield* client.records.create({
          collection,
          rkey: config.rkey,
          record,
        });

        return {
          newState: {
            status: record.status,
            createdAt: record.createdAt,
            collection,
            rkey,
            cid,
          },
        };
      });
    },

    update({ config, priorState: prior }, client) {
      return Effect.gen(function* () {
        const record = {
          status: config.status,
          createdAt: config.createdAt ?? prior.createdAt,
        } as const;

        const { cid } = yield* client.records.update({
          collection,
          rkey: prior.rkey,
          record,
        });

        return {
          newState: {
            status: record.status,
            createdAt: record.createdAt,
            rkey: prior.rkey,
            collection,
            cid,
          },
        };
      });
    },

    delete({ priorState: prior }, client) {
      return client.records.delete({ collection, rkey: prior.rkey });
    },
  },
);
