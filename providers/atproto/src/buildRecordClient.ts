import type { Client } from "@atcute/client";
import type { Records } from "@atcute/lexicons/ambient";
import type * as v from "@atcute/lexicons/validations";
import { DiagnosticError } from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { RemoteResourceNotFound } from "@entropitor/terraform-provider-sdk/src/resource.js";
import { Effect } from "effect";

export type Collection = `${string}.${string}.${string}`;

export type RecordFor<TCollection extends Collection> =
  TCollection extends keyof Records ?
    Records[TCollection] extends v.BaseSchema ?
      Omit<v.InferInput<Records[TCollection]>, "$type"> & {
        $type?: TCollection;
      }
    : Records[TCollection]
  : Record<string, unknown>;

export const buildRecordClient = ({
  rpc,
  repo,
}: {
  rpc: Client;
  repo: `did:${string}:${string}`;
}) => {
  const getRecord: <TCollection extends Collection>(args: {
    collection: TCollection;
    rkey: string;
  }) => Effect.Effect<
    {
      record: RecordFor<TCollection>;
      uri: string;
      cid: string;
    },
    DiagnosticError | RemoteResourceNotFound
  > = Effect.fn("getRecord")(function* ({ collection, rkey }) {
    const response = yield* Effect.promise(() =>
      rpc.get("com.atproto.repo.getRecord", {
        params: { repo, collection, rkey },
      }),
    );

    if (response.status === 400) {
      return yield* Effect.fail(new RemoteResourceNotFound());
    }
    if (!response.ok) {
      return yield* Effect.fail(
        DiagnosticError.from([], "Failed to get record", response.data.error),
      );
    }

    return {
      record: response.data.value as RecordFor<typeof collection>,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      cid: response.data.cid!,
      uri: response.data.uri,
    };
  });

  const createRecord = Effect.fn("createRecord")(function* <
    TCollection extends Collection,
  >({
    collection,
    rkey,
    record,
  }: {
    collection: TCollection;
    rkey: null | string;
    record: RecordFor<TCollection>;
  }) {
    const response = yield* Effect.promise(() =>
      rpc.post("com.atproto.repo.createRecord", {
        input: {
          repo,
          collection,
          rkey: rkey ?? undefined,
          // @ts-expect-error TypeScript doesn't know we have specialized the collection type
          record,
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const createdRkey = response.data.uri.split("/").pop()!;
    return {
      collection,
      rkey: createdRkey,
      cid: response.data.cid,
      record: record as Record<string, unknown>,
      uri: response.data.uri,
    };
  });

  const updateRecord = Effect.fn("updateRecord")(function* <
    TCollection extends Collection,
  >({
    collection,
    rkey,
    record,
  }: {
    collection: TCollection;
    rkey: string;
    record: RecordFor<TCollection>;
  }) {
    const response = yield* Effect.promise(() =>
      rpc.post("com.atproto.repo.putRecord", {
        input: {
          repo,
          collection,
          rkey,
          record: record as Record<string, unknown>,
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
      collection,
      rkey,
      cid: response.data.cid,
      record,
      uri: response.data.uri,
    };
  });

  const deleteRecord = Effect.fn("deleteRecord")(function* ({
    collection,
    rkey,
  }: {
    collection: Collection;
    rkey: string;
  }) {
    yield* Effect.promise(() =>
      rpc.post("com.atproto.repo.deleteRecord", {
        input: {
          repo,
          collection,
          rkey,
        },
      }),
    );
  });

  return {
    get: getRecord,
    create: createRecord,
    update: updateRecord,
    delete: deleteRecord,
  };
};
