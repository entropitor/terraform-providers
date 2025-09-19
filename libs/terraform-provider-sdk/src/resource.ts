/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { MessageInitShape } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import { Effect } from "effect";

import type { ConfigFor, Schema, StateFor } from "./attributes.js";
import { decodeWithSchema, encodeWithSchema } from "./codec.js";
import type { DiagnosticError, Diagnostics } from "./diagnostics.js";
import { withDiagnostics } from "./diagnostics.js";
import type { ReadResource_ResponseSchema } from "./gen/tfplugin6/tfplugin6.7_pb.js";
import {
  type ApplyResourceChange_Request,
  Diagnostic_Severity,
  type ImportResourceState_Request,
  type ImportResourceState_ResponseSchema,
  type PlanResourceChange_Request,
  type PlanResourceChange_ResponseSchema,
  type ReadResource_Request,
  type ValidateResourceConfig_Request,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";
import { preValidateSchema } from "./pre-validate.js";
import { preprocessPlan } from "./preprocess-plan.js";
import type { ProviderForResources } from "./provider.js";
import {
  type RequiresReplacementTracker,
  withTrackedReplacements,
} from "./require-replacement.js";

type PlanRequest<TResourceSchema extends Schema> = {
  config: ConfigFor<TResourceSchema>;
  priorState: null | StateFor<TResourceSchema>;
  proposedNewState: StateFor<TResourceSchema>;
  proposedNewStateIsPriorState: boolean;
};
type ReadRequest<TResourceSchema extends Schema> = {
  savedState: StateFor<TResourceSchema>;
};
type ImportRequest<_TResourceSchema extends Schema> = {
  resourceId: string;
};
type CreateRequest<TResourceSchema extends Schema> = {
  config: ConfigFor<TResourceSchema>;
  priorState: null;
};
type UpdateRequest<TResourceSchema extends Schema> = {
  config: ConfigFor<TResourceSchema>;
  priorState: StateFor<TResourceSchema>;
};
type DeleteRequest<TResourceSchema extends Schema> = {
  config: null;
  priorState: StateFor<TResourceSchema>;
};

type PlanResponse<TResourceSchema extends Schema> = {
  plannedState: StateFor<TResourceSchema>;
};

type ReadResponse<TResourceSchema extends Schema> = {
  currentState: null | StateFor<TResourceSchema>;
};
type ImportResponse<TResourceSchema extends Schema> = {
  currentState: StateFor<TResourceSchema>;
};
type CreateResponse<TResourceSchema extends Schema> = {
  newState: StateFor<TResourceSchema>;
};
type UpdateResponse<TResourceSchema extends Schema> = {
  newState: StateFor<TResourceSchema>;
};
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type DeleteResponse<_TResourceSchema extends Schema> = {};

export class RemoteResourceNotFound {
  readonly _tag = "RemoteResourceNotFound";
}

export type IResource<TResourceSchema extends Schema, TProviderState> = {
  create: (
    req: NoInfer<CreateRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<CreateResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
  delete: (
    req: NoInfer<DeleteRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<DeleteResponse<TResourceSchema>> | void,
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

  plan?: (
    req: NoInfer<PlanRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<PlanResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics | RequiresReplacementTracker
  >;
  read: (
    req: NoInfer<ReadRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<ReadResponse<TResourceSchema>>,
    DiagnosticError | RemoteResourceNotFound,
    Diagnostics
  >;

  schema: TResourceSchema;
  update: (
    req: NoInfer<UpdateRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<UpdateResponse<TResourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
  validate?: (
    config: NoInfer<ConfigFor<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<void, never, Diagnostics>;
};

export type Resource = ReturnType<typeof createResource>;

export const createResource = <TResourceSchema extends Schema, TState>(
  provider: ProviderForResources<TState>,
  resource: IResource<TResourceSchema, NoInfer<TState>>,
) => {
  type ResourceConfig = ConfigFor<TResourceSchema>;
  type ResourceState = StateFor<TResourceSchema>;

  return {
    schema: resource.schema,

    async validateResourceConfig(
      req: ValidateResourceConfig_Request,
      ctx: HandlerContext,
    ) {
      console.error(
        "[ERROR] validateResourceConfig",
        provider.providerInstanceId,
      );
      const config: ResourceConfig = decodeWithSchema(
        req.config!.msgpack,
        resource.schema,
      );

      return await Effect.runPromise(
        Effect.gen(function* () {
          yield* preValidateSchema(config, resource.schema);

          if (resource.validate == null) {
            return {};
          }

          return yield* resource.validate(config, provider.state);
        }).pipe(withDiagnostics()),
        { signal: ctx.signal },
      );
    },
    async planResourceChange(
      req: PlanResourceChange_Request,
      ctx: HandlerContext,
    ): Promise<MessageInitShape<typeof PlanResourceChange_ResponseSchema>> {
      console.error("[ERROR] planResourceChange", provider.providerInstanceId);

      const [response, requiresReplace] = await Effect.runPromise(
        Effect.gen(function* () {
          const priorState: ResourceState = decodeWithSchema(
            req.priorState!.msgpack,
            resource.schema,
          );
          const proposedNewState: ResourceState = yield* preprocessPlan<
            typeof resource.schema
          >(
            resource.schema,
            priorState,
            decodeWithSchema(req.proposedNewState!.msgpack, resource.schema),
          );

          if (resource.plan == null) {
            return {
              plannedState: {
                msgpack: encodeWithSchema(proposedNewState, resource.schema),
              },
            };
          }

          const config: ResourceConfig = decodeWithSchema(
            req.config!.msgpack,
            resource.schema,
          );
          const same =
            req.proposedNewState?.msgpack.length ===
              req.priorState?.msgpack.length &&
            req.proposedNewState?.msgpack.every(
              (byte, index) => byte === req.priorState?.msgpack[index],
            );

          return yield* resource
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
                  msgpack: encodeWithSchema(
                    response.plannedState,
                    resource.schema,
                  ),
                },
              })),
            );
        }).pipe(withDiagnostics(), withTrackedReplacements()),
        { signal: ctx.signal },
      );

      return {
        ...response,
        requiresReplace,
      };
    },

    async applyResourceChange(
      req: ApplyResourceChange_Request,
      ctx: HandlerContext,
    ) {
      console.error("[ERROR] applyResourceChange", provider.providerInstanceId);
      const config: null | ResourceConfig = decodeWithSchema(
        req.config!.msgpack,
        resource.schema,
      );
      const priorState: null | ResourceState = decodeWithSchema(
        req.priorState!.msgpack,
        resource.schema,
      );

      return await Effect.runPromise(
        Effect.gen(function* () {
          if (priorState == null) {
            const response = yield* resource.create(
              { config: config!, priorState: null },
              provider.state,
            );
            return {
              newState: {
                msgpack: encodeWithSchema(response.newState, resource.schema),
              },
            };
          } else if (config != null) {
            const response = yield* resource.update(
              { config, priorState },
              provider.state,
            );
            return {
              newState: {
                msgpack: encodeWithSchema(response.newState, resource.schema),
              },
            };
          } else {
            yield* resource.delete(
              { config: null, priorState },
              provider.state,
            );
            return {
              newState: {
                msgpack: encodeWithSchema(null, resource.schema),
              },
            };
          }
        }).pipe(withDiagnostics()),
        { signal: ctx.signal },
      );
    },
    async readResource(req: ReadResource_Request, ctx: HandlerContext) {
      console.error("[ERROR] readResource", provider.providerInstanceId);
      const savedState: null | ResourceState = decodeWithSchema(
        req.currentState!.msgpack,
        resource.schema,
      );
      if (savedState == null) {
        return {
          newState: { msgpack: encodeWithSchema(null, resource.schema) },
        };
      }
      return await Effect.runPromise<
        MessageInitShape<typeof ReadResource_ResponseSchema>,
        never
      >(
        resource.read({ savedState }, provider.state).pipe(
          Effect.catchTag("RemoteResourceNotFound", () =>
            Effect.succeed({
              currentState: null,
            }),
          ),
          Effect.map((response) => ({
            newState: {
              msgpack: encodeWithSchema(response.currentState, resource.schema),
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
    ): Promise<MessageInitShape<typeof ImportResourceState_ResponseSchema>> {
      console.error("[ERROR] importResourceState", provider.providerInstanceId);

      if (resource.import == null) {
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
        resource.import({ resourceId }, provider.state).pipe(
          Effect.map((response) => ({
            importedResources: [
              {
                typeName: req.typeName,
                state: {
                  msgpack: encodeWithSchema(
                    response.currentState,
                    resource.schema,
                  ),
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
