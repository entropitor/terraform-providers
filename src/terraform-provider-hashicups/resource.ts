import type { ConfigFor, StateFor, Schema } from "./attributes.js";
import { Effect } from "effect";
import { decode } from "./codec.js";
import type { HandlerContext } from "@connectrpc/connect";
import type { PartialMessage } from "@bufbuild/protobuf";
import type {
  ApplyResourceChange_Request,
  ApplyResourceChange_Response,
  PlanResourceChange_Request,
  PlanResourceChange_Response,
  ValidateDataResourceConfig_Request,
  ValidateResourceConfig_Response,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import type { ProviderForResources } from "./provider.js";

interface PlanRequest<TResourceSchema extends Schema> {
  config: ConfigFor<TResourceSchema>;
  proposedNewState: NoInfer<StateFor<TResourceSchema>>;
  priorState: NoInfer<StateFor<TResourceSchema>>;
  proposedNewStateIsPriorState: boolean;
}
interface ApplyRequest<TResourceSchema extends Schema> {
  config: ConfigFor<TResourceSchema>;
  priorState: NoInfer<StateFor<TResourceSchema>>;
}

export interface IResource<TResourceSchema extends Schema, TProviderState> {
  schema: TResourceSchema;
  validate: (
    config: NoInfer<ConfigFor<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<PartialMessage<ValidateResourceConfig_Response>>;
  plan: (
    req: NoInfer<PlanRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<PartialMessage<PlanResourceChange_Response>>;
  apply: (
    req: NoInfer<ApplyRequest<TResourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<PartialMessage<ApplyResourceChange_Response>>;
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
      return await Effect.runPromise(args.validate(config, provider.state), {
        signal: ctx.signal,
      });
    },
    async planResourceChange(
      req: PlanResourceChange_Request,
      ctx: HandlerContext,
    ) {
      console.error("[ERROR] planResourceChange", provider.providerInstanceId);
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
        args.plan(
          {
            config,
            priorState,
            proposedNewState,
            proposedNewStateIsPriorState: same ?? false,
          },
          provider.state,
        ),
        {
          signal: ctx.signal,
        },
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
        args.apply({ config, priorState }, provider.state),
        {
          signal: ctx.signal,
        },
      );
    },
  };
};
