import type { Client } from "@atcute/client";
import { DiagnosticError } from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { RemoteResourceNotFound } from "@entropitor/terraform-provider-sdk/src/resource.js";
import { Effect } from "effect";

export type Collection = `${string}.${string}.${string}`;

export const buildRecordClient = ({
  rpc,
  repo,
}: {
  rpc: Client;
  repo: `did:${string}:${string}`;
}) => {
  const getRecord = Effect.fn("getRecord")(function* ({
    collection,
    rkey,
  }: {
    collection: Collection;
    rkey: string;
  }) {
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
      record: response.data.value,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      cid: response.data.cid!,
    };
  });

  const createRecord = Effect.fn("createRecord")(function* ({
    collection,
    rkey,
    record,
  }: {
    collection: Collection;
    rkey: null | string;
    record: Record<string, unknown>;
  }) {
    const response = yield* Effect.promise(() =>
      rpc.post("com.atproto.repo.createRecord", {
        input: {
          repo,
          collection,
          rkey: rkey ?? undefined,
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
      record,
    };
  });

  const updateRecord = Effect.fn("updateRecord")(function* ({
    collection,
    rkey,
    record,
  }: {
    collection: Collection;
    rkey: string;
    record: Record<string, unknown>;
  }) {
    const response = yield* Effect.promise(() =>
      rpc.post("com.atproto.repo.putRecord", {
        input: {
          repo,
          collection,
          rkey,
          record,
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
