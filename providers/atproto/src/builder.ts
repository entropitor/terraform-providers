import { Client, CredentialManager } from "@atcute/client";
export type { Client } from "@atcute/client";
import type {} from "@atcute/atproto";
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from "@atcute/identity-resolver";
import { NodeDnsHandleResolver } from "@atcute/identity-resolver-node";
import {
  attributeType,
  diagnosticsPath,
  providerBuilder,
  schema,
  tf,
  transform,
} from "@entropitor/terraform-provider-sdk";
import {
  DiagnosticError,
  Diagnostics,
} from "@entropitor/terraform-provider-sdk/src/diagnostics.js";
import { Effect } from "effect";

const messageFrom = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error occurred";
};

type Did = `did:plc:${string}` | `did:web:${string}`;
type Handle = `${string}.${string}`;
type DidOrHandle = Did | Handle;
const isDid = (didOrHandle: DidOrHandle): didOrHandle is Did => {
  return didOrHandle.startsWith("did:");
};
const parseDidOrHandle = (didOrHandle: DidOrHandle) => {
  if (isDid(didOrHandle)) {
    return { type: "did", did: didOrHandle } as const;
  }
  return { type: "handle", handle: didOrHandle } as const;
};

export const atprotoProviderBuilder = providerBuilder({
  name: "atproto",
  schema: schema({
    handle: tf.required.custom(
      transform(attributeType.string, (s) => s as DidOrHandle),
    ),
    app_password: tf.required.string(),
  }),

  configure({ config }) {
    return Effect.gen(function* () {
      const handleResolver = new CompositeHandleResolver({
        strategy: "race",
        methods: {
          dns: new NodeDnsHandleResolver(),
          http: new WellKnownHandleResolver(),
        },
      });
      const didResolver = new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver(),
          web: new WebDidDocumentResolver(),
        },
      });

      const didOrHandle = parseDidOrHandle(config.handle);
      const did =
        didOrHandle.type === "did" ?
          didOrHandle.did
        : yield* Effect.tryPromise({
            try: (signal) =>
              handleResolver.resolve(didOrHandle.handle, { signal }),
            catch: (error) =>
              DiagnosticError.from(
                diagnosticsPath.for("handle"),
                "Invalid handle",
                messageFrom(error),
              ),
          });

      const didDocument = yield* Effect.tryPromise({
        try: (signal) => didResolver.resolve(did, { signal }),
        catch: (error) =>
          DiagnosticError.from(
            diagnosticsPath.for("handle"),
            "Failed did document resolution",
            messageFrom(error),
          ),
      });

      const pdsUrl = didDocument.service?.find(
        (service) => service.id === "#atproto_pds",
      )?.serviceEndpoint;

      if (pdsUrl == null || typeof pdsUrl !== "string") {
        return yield* Diagnostics.crit(
          [diagnosticsPath.attribute("handle")],
          "No pds url in did document",
          "Your did document does not contain a service endpoint for the atproto protocol. Please ensure your did document is correctly configured.",
        );
      }

      const manager = new CredentialManager({
        service: pdsUrl,
      });
      const rpc = new Client({ handler: manager });

      const session = yield* Effect.tryPromise({
        try: () =>
          manager.login({
            identifier: config.handle,
            password: config.app_password,
          }),
        catch: (error) =>
          DiagnosticError.from(
            diagnosticsPath.for("app_password"),
            "Invalid credentials",
            messageFrom(error),
          ),
      });

      return { $state: { rpc, session } };
    });
  },
});
