/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  attributeType,
  requiresReplacementOnChange,
  schema,
  tf,
  transform,
  Unknown,
} from "@entropitor/terraform-provider-sdk";
import {
  DiagnosticError,
  Diagnostics,
} from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { Effect } from "effect";

import { atprotoProviderBuilder } from "../builder.js";

// TODO: we should make this return an effect that can give DiagnosticError
const parseCollectionName = (s: string): `${string}.${string}.${string}` => {
  return s as `${string}.${string}.${string}`;
};

export const atprotoRecordResource = atprotoProviderBuilder.resource({
  schema: schema({
    rkey: tf.computedIfNotGiven.string().pipe(requiresReplacementOnChange()),
    collection: tf.required.custom(
      transform(attributeType.string, parseCollectionName),
    ),
    record: tf.required.any(),
    cid: tf.alwaysComputed.string(),
  }),

  read({ savedState }, client) {
    return Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        client.rpc.get("com.atproto.repo.getRecord", {
          params: {
            repo: client.session.did,
            collection: savedState.collection,
            rkey: savedState.rkey,
          },
        }),
      );

      if (!response.ok) {
        if (response.status === 400) {
          return { currentState: null };
        }
        return yield* Effect.fail(
          DiagnosticError.from([], "Failed to read", response.data.error),
        );
      }
      const record = response.data;
      return {
        currentState: {
          ...savedState,
          cid: record.cid!,
          record: record.value,
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

      const response = yield* Effect.promise(() =>
        client.rpc.get("com.atproto.repo.getRecord", {
          params: {
            repo: client.session.did,
            collection,
            rkey,
          },
        }),
      );
      if (!response.ok) {
        return yield* Effect.fail(
          DiagnosticError.from(
            [],
            "Failed to import record",
            response.data.error,
          ),
        );
      }

      return {
        currentState: {
          rkey,
          collection,
          record: response.data.value,
          cid: response.data.cid!,
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
      const response = yield* Effect.promise(() =>
        client.rpc.post("com.atproto.repo.createRecord", {
          input: {
            collection: config.collection,
            record: config.record,
            repo: client.session.did,
            rkey: config.rkey ?? undefined,
          },
        }),
      );
      if (!response.ok) {
        return yield* Effect.fail(
          DiagnosticError.from(
            [],
            "Failed to create record",
            response.data.error,
          ),
        );
      }
      const createdRkey = response.data.uri.split("/").pop()!;
      return {
        newState: {
          record: config.record,
          rkey: createdRkey,
          collection: config.collection,
          cid: response.data.cid,
        },
      };
    });
  },
  update({ config, priorState: prior }, client) {
    return Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        client.rpc.post("com.atproto.repo.putRecord", {
          input: {
            repo: client.session.did,
            collection: prior.collection,
            rkey: prior.rkey,
            record: config.record,
          },
        }),
      );
      if (!response.ok) {
        return yield* Effect.fail(
          DiagnosticError.from(
            [],
            "Failed to update record",
            response.data.error,
          ),
        );
      }
      return {
        newState: {
          record: config.record,
          rkey: config.rkey ?? prior.rkey,
          collection: config.collection,
          cid: response.data.cid,
        },
      };
    });
  },
  delete({ priorState: prior }, client) {
    return Effect.promise(async () => {
      await client.rpc.post("com.atproto.repo.deleteRecord", {
        input: {
          repo: client.session.did,
          collection: prior.collection,
          rkey: prior.rkey,
        },
      });
    });
  },
});
