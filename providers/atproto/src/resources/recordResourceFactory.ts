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
  const recordSchema = schema({
    ...recordDefinition.schema,

    rkey: tf.computedIfNotGiven.string().pipe(requiresReplacementOnChange()),
    cid: tf.alwaysComputed.string(),
    uri: tf.alwaysComputed.string(),
  });
  const recordConfig = (config: ConfigFor<typeof recordSchema>) => {
    const { rkey: _rkey, cid: _cid, uri: _uri, ...recordConfig } = config;
    return recordConfig as ConfigFor<{ attributes: TFields }>;
  };

  return atprotoProviderBuilder.resource({
    schema: recordSchema,

    // @ts-expect-error TypeScript doesn't know that the return type is correct
    read({ savedState }, client) {
      return Effect.gen(function* () {
        const { cid, record, uri } = yield* client.records.get({
          collection: recordDefinition.collection,
          // @ts-expect-error TypeScript doesn't know that schema doesn't override rkey for some reason
          rkey: savedState.rkey,
        });

        return {
          currentState: {
            rkey: savedState.rkey,
            ...recordDefinition.recordToState(record),
            cid,
            uri,
          },
        };
      });
    },

    // @ts-expect-error TypeScript doesn't know that the return type is correct
    import({ resourceId: rkey }, client) {
      return Effect.gen(function* () {
        const { cid, record, uri } = yield* client.records
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
            ...recordDefinition.recordToState(record),
            rkey,
            cid,
            uri,
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
        const record = recordDefinition.recordForCreation(recordConfig(config));
        const { rkey, cid, uri } = yield* client.records.create({
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
            uri,
          },
        };
      });
    },

    // @ts-expect-error TypeScript doesn't know that the return type is correct
    update({ config, priorState: prior }, client) {
      return Effect.gen(function* () {
        const record = recordDefinition.recordForUpdate(
          recordConfig(config),
          prior as StateFor<{ attributes: TFields }>,
        );

        const { cid, uri } = yield* client.records.update({
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
            uri,
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
