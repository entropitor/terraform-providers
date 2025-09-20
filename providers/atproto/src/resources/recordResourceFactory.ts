import {
  Diagnostics,
  requiresReplacementOnChange,
  schema,
  tf,
  Unknown,
} from "@entropitor/terraform-provider-sdk";
import type {
  AttributeFields,
  ConfigFor,
  StateFor,
} from "@entropitor/terraform-provider-sdk/src/attributes.js";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../builder.js";
import type { Collection, RecordFor } from "../buildRecordClient.js";

export const createRecordResource = <
  TCollection extends Collection,
  TFields extends AttributeFields,
>(recordDefinition: {
  schema: TFields;
  collection: TCollection;

  recordToState: (
    record: RecordFor<TCollection>,
  ) => StateFor<{ attributes: TFields }>;
  recordForCreation: (
    config: ConfigFor<{ attributes: TFields }>,
  ) => RecordFor<TCollection>;
  recordForUpdate: (
    config: ConfigFor<{ attributes: TFields }>,
    priorState: StateFor<{ attributes: TFields }>,
  ) => RecordFor<TCollection>;
}) => {
  return atprotoProviderBuilder.resource({
    schema: schema({
      ...recordDefinition.schema,

      rkey: tf.computedIfNotGiven.string().pipe(requiresReplacementOnChange()),
      cid: tf.alwaysComputed.string(),
    }),

    read({ savedState }, client) {
      return Effect.gen(function* () {
        const { cid, record } = yield* client.records.get({
          collection: recordDefinition.collection,
          // @ts-expect-error TypeScript doesn't know that schema doesn't override rkey for some reason
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

    // @ts-expect-error TypeScript doesn't know that the return type is correct
    import({ resourceId: rkey }, client) {
      return Effect.gen(function* () {
        const { cid, record } = yield* client.records
          .get({
            collection: recordDefinition.collection,
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
            cid,
            ...recordDefinition.recordToState(record),
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

    // @ts-expect-error TypeScript doesn't know that the return type is correct
    create({ config }, client) {
      return Effect.gen(function* () {
        // @ts-expect-error TypeScript doesn't know that config should be supertype of ConfigFor
        const record = recordDefinition.recordForCreation(config);
        const { rkey, cid } = yield* client.records.create({
          collection: recordDefinition.collection,
          // @ts-expect-error TypeScript doesn't know that schema doesn't override rkey for some reason
          rkey: config.rkey,
          record,
        });

        return {
          newState: {
            ...recordDefinition.recordToState(record),
            rkey,
            cid,
          },
        };
      });
    },

    // @ts-expect-error TypeScript doesn't know that the return type is correct
    update({ config, priorState: prior }, client) {
      return Effect.gen(function* () {
        // @ts-expect-error TypeScript doesn't know that config should be supertype of ConfigFor
        const record = recordDefinition.recordForUpdate(config, prior);

        const { cid } = yield* client.records.update({
          collection: recordDefinition.collection,
          // @ts-expect-error TypeScript doesn't know that schema doesn't override rkey for some reason
          rkey: prior.rkey,
          record,
        });

        return {
          newState: {
            ...recordDefinition.recordToState(record),
            rkey: prior.rkey,
            cid,
          },
        };
      });
    },

    delete({ priorState: prior }, client) {
      return client.records.delete({
        collection: recordDefinition.collection,
        // @ts-expect-error TypeScript doesn't know that schema doesn't override rkey for some reason
        rkey: prior.rkey,
      });
    },
  });
};
