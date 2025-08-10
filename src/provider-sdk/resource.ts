import type { ConfigFor, StateFor, Schema } from "./attributes.js";
import { Effect } from "effect";
import { decode, encode, encodeWithSchema } from "./codec.js";
import type { HandlerContext } from "@connectrpc/connect";
import {
  Diagnostic_Severity,
  type ApplyResourceChange_Request,
  type ImportResourceState_Request,
  type ImportResourceState_Response,
  type PlanResourceChange_Request,
  type ReadResource_Request,
  type ValidateDataResourceConfig_Request,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import type { ProviderForResources } from "./provider.js";
import {
  DiagnosticError,
  Diagnostics,
  withDiagnostics,
} from "./diagnostics.js";
import type { PartialMessage } from "@bufbuild/protobuf";

interface PlanRequest<TResourceSchema extends Schema> {
  config: ConfigFor<TResourceSchema>;
  proposedNewState: NoInfer<StateFor<TResourceSchema>>;
  priorState: NoInfer<StateFor<TResourceSchema>>;
  proposedNewStateIsPriorState: boolean;
}
interface ReadRequest<TResourceSchema extends Schema> {
  savedState: StateFor<TResourceSchema>;
}
interface ImportRequest<_TResourceSchema extends Schema> {
  resourceId: string;
}
interface CreateRequest<TResourceSchema extends Schema> {
  config: ConfigFor<TResourceSchema>;
  priorState: null;
}
interface UpdateRequest<TResourceSchema extends Schema> {
  config: ConfigFor<TResourceSchema>;
  priorState: StateFor<TResourceSchema>;
}
interface DeleteRequest<TResourceSchema extends Schema> {
  config: null;
  priorState: StateFor<TResourceSchema>;
}

interface PlanResponse<TResourceSchema extends Schema> {
  plannedState: StateFor<TResourceSchema>;
}

interface ReadResponse<TResourceSchema extends Schema> {
  currentState: StateFor<TResourceSchema>;
}
interface ImportResponse<TResourceSchema extends Schema> {
  currentState: StateFor<TResourceSchema>;
}
interface CreateResponse<TResourceSchema extends Schema> {
  newState: StateFor<TResourceSchema>;
}
interface UpdateResponse<TResourceSchema extends Schema> {
  newState: StateFor<TResourceSchema>;
}
interface DeleteResponse<_TResourceSchema extends Schema> {}

export interface IResource<TResourceSchema extends Schema, TProviderState> {
  schema: TResourceSchema;
  validate?: (
    config: NoInfer<ConfigFor<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<void, never, Diagnostics>;
  plan?: (
    req: NoInfer<PlanRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<PlanResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;

  read: (
    req: NoInfer<ReadRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<ReadResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
  import?: (
    req: NoInfer<ImportRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<ImportResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;

  create: (
    req: NoInfer<CreateRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<CreateResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
  update: (
    req: NoInfer<UpdateRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<UpdateResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
  delete: (
    req: NoInfer<DeleteRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    void | NoInfer<DeleteResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
}

export type Resource = ReturnType<typeof resource>;

export const resource = <TResourceSchema extends Schema, TState>(
  provider: ProviderForResources<TState>,
  args: IResource<TResourceSchema, TState>,
) => {
  type ResourceConfig = ConfigFor<TResourceSchema>;
  type ResourceState = StateFor<TResourceSchema>;

  return {
    schema: args.schema,

    async validateResourceConfig(
      req: ValidateDataResourceConfig_Request,
      ctx: HandlerContext,
    ) {
      console.error(
        "[ERROR] validateResourceConfig",
        provider.providerInstanceId,
      );
      const config: ResourceConfig = decode(req.config!.msgpack);

      if (args.validate == null) {
        return {};
      }

      return await Effect.runPromise(
        args.validate(config, provider.state).pipe(withDiagnostics()),
        { signal: ctx.signal },
      );
    },
    async planResourceChange(
      req: PlanResourceChange_Request,
      ctx: HandlerContext,
    ) {
      console.error("[ERROR] planResourceChange", provider.providerInstanceId);

      if (args.plan == null) {
        return {
          plannedState: { msgpack: req.proposedNewState!.msgpack },
        };
      }

      const config: ResourceConfig = decode(req.config!.msgpack);
      const priorState: ResourceState = decode(req.priorState!.msgpack);
      const proposedNewState: ResourceState = decode(
        req.proposedNewState!.msgpack,
      );
      const same =
        req.proposedNewState?.msgpack.length ==
          req.priorState?.msgpack.length &&
        req.proposedNewState?.msgpack.every(
          (byte, index) => byte == req.priorState?.msgpack[index],
        );
      return await Effect.runPromise(
        args
          .plan(
            {
              config,
              priorState,
              proposedNewState,
              proposedNewStateIsPriorState: same ?? false,
            },
            provider.state,
          )
          .pipe(
            Effect.map((response) => ({
              plannedState: {
                msgpack: encodeWithSchema(response.plannedState, args.schema),
              },
            })),
            withDiagnostics(),
          ),
        { signal: ctx.signal },
      );
    },

    async applyResourceChange(
      req: ApplyResourceChange_Request,
      ctx: HandlerContext,
    ) {
      console.error("[ERROR] applyResourceChange", provider.providerInstanceId);
      const config: ResourceConfig = decode(req.config!.msgpack);
      const priorState: ResourceState = decode(req.priorState!.msgpack);

      return await Effect.runPromise(
        Effect.gen(function* () {
          if (priorState == null) {
            const response = yield* args.create(
              { config, priorState: null },
              provider.state,
            );
            return {
              newState: {
                msgpack: encodeWithSchema(response.newState, args.schema),
              },
            };
          } else if (config != null) {
            const response = yield* args.update(
              { config, priorState },
              provider.state,
            );
            return {
              newState: {
                msgpack: encodeWithSchema(response.newState, args.schema),
              },
            };
          } else {
            yield* args.delete({ config: null, priorState }, provider.state);
            return {
              newState: { msgpack: encodeWithSchema(null, args.schema) },
            };
          }
        }).pipe(withDiagnostics()),
        { signal: ctx.signal },
      );
    },
    async readResource(req: ReadResource_Request, ctx: HandlerContext) {
      console.error("[ERROR] readResource", provider.providerInstanceId);
      const savedState = decode(req.currentState!.msgpack);
      if (savedState == null) {
        return { newState: { msgpack: encode(null) } };
      }
      return await Effect.runPromise(
        args.read({ savedState }, provider.state).pipe(
          Effect.map((response) => ({
            newState: {
              msgpack: encodeWithSchema(response.currentState, args.schema),
            },
          })),
          withDiagnostics(),
        ),
        { signal: ctx.signal },
      );
    },
    async importResource(
      req: ImportResourceState_Request,
      ctx: HandlerContext,
    ): Promise<PartialMessage<ImportResourceState_Response>> {
      console.error("[ERROR] importResourceState", provider.providerInstanceId);

      if (args.import == null) {
        return {
          diagnostics: [
            {
              severity: Diagnostic_Severity.ERROR,
              summary: "Import not supported",
              detail: `Resource ${req.typeName} does not support being imported.`,
            },
          ],
        };
      }

      const resourceId = req.id;
      return await Effect.runPromise(
        args.import({ resourceId }, provider.state).pipe(
          Effect.map((response) => ({
            importedResources: [
              {
                typeName: req.typeName,
                state: {
                  msgpack: encodeWithSchema(response.currentState, args.schema),
                },
              },
            ],
          })),
          withDiagnostics(),
        ),
        { signal: ctx.signal },
      );
    },
  };
};
