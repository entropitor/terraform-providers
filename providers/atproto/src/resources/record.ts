import {
  attributeType,
  requiresReplacementOnChange,
  schema,
  tf,
  transform,
  Unknown,
  withDescription,
} from "@entropitor/terraform-provider-sdk";
import { Diagnostics } from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../builder.js";

// TODO: we should make this return an effect that can give DiagnosticError
const parseCollectionName = (s: string): `${string}.${string}.${string}` => {
  return s as `${string}.${string}.${string}`;
};

export const atprotoRecordResource = atprotoProviderBuilder.resource({
  schema: schema({
    rkey: tf.computedIfNotGiven
      .string()
      .pipe(
        requiresReplacementOnChange(),
        withDescription(
          "The rkey for this record. Will be created by your PDS if not given.",
        ),
      ),
    collection: tf.required
      .custom(transform(attributeType.string, parseCollectionName))
      .pipe(
        requiresReplacementOnChange(),
        withDescription("The collection for this record."),
      ),
    record: tf.required
      .any()
      .pipe(
        withDescription(
          "The record content. This is the exact 'json' object as  you want it to appear on your PDS.",
        ),
      ),
    cid: tf.alwaysComputed
      .string()
      .pipe(
        withDescription(
          "The CID of this record, as computed by your PDS after creating/updating your record.",
        ),
      ),
  }),

  read({ savedState }, client) {
    return Effect.gen(function* () {
      const { cid, record } = yield* client.records.get({
        collection: savedState.collection,
        rkey: savedState.rkey,
      });

      return {
        currentState: {
          ...savedState,
          cid,
          record,
        },
      };
    });
  },

  import({ resourceId }, client) {
    return Effect.gen(function* () {
      const [collectionRaw, rkey] = resourceId.split("/");
      if (collectionRaw == null || rkey == null) {
        return yield* Diagnostics.crit(
          [],
          `The import id should be in the format [collection]/[rkey] instead of ${resourceId}`,
        );
      }
      const collection = parseCollectionName(collectionRaw);

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
          record,
          cid,
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
      const { rkey, cid } = yield* client.records.create({
        collection: config.collection,
        rkey: config.rkey,
        record: config.record,
      });
      return {
        newState: {
          record: config.record,
          rkey,
          collection: config.collection,
          cid,
        },
      };
    });
  },

  update({ config, priorState: prior }, client) {
    return Effect.gen(function* () {
      const { cid } = yield* client.records.update({
        collection: prior.collection,
        rkey: prior.rkey,
        record: config.record,
      });

      return {
        newState: {
          record: config.record,
          rkey: prior.rkey,
          collection: prior.collection,
          cid,
        },
      };
    });
  },

  delete({ priorState: prior }, client) {
    return client.records.delete({
      collection: prior.collection,
      rkey: prior.rkey,
    });
  },
});
