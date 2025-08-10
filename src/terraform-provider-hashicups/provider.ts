import type {
  ConfigureProvider_Request,
  ConfigureProvider_Response,
  ValidateProviderConfig_Request,
  ValidateProviderConfig_Response,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import type { ConfigFor, Schema } from "./attributes.js";
import { Effect } from "effect";
import { decode } from "./codec.js";
import type { HandlerContext } from "@connectrpc/connect";
import type { PartialMessage } from "@bufbuild/protobuf";

interface IProvider<
  TProviderSchema extends Schema,
  TState extends object = {},
> {
  schema: TProviderSchema;
  configure: (
    config: ConfigFor<TProviderSchema>,
  ) => Effect.Effect<
    { $state: TState } & PartialMessage<ConfigureProvider_Response>
  >;
  validate: (
    config: ConfigFor<TProviderSchema>,
  ) => Effect.Effect<PartialMessage<ValidateProviderConfig_Response>>;
}

export const provider = <TState extends object, TProviderSchema extends Schema>(
  args: IProvider<TProviderSchema, TState>,
) => {
  const providerInstanceId = Math.floor(Math.random() * 1000);
  type ProviderConfig = ConfigFor<TProviderSchema>;

  let state: TState = undefined as any;
  return {
    get state() {
      return state;
    },
    providerInstanceId,
    providerSchema: args.schema,

    async validateProviderConfig(
      req: ValidateProviderConfig_Request,
      ctx: HandlerContext,
    ) {
      console.error("[ERROR] validateProviderConfig", providerInstanceId);
      const decoded: ProviderConfig = decode(req.config!.msgpack);
      return await Effect.runPromise(args.validate(decoded), {
        signal: ctx.signal,
      });
    },
    async configureProvider(
      req: ConfigureProvider_Request,
      ctx: HandlerContext,
    ) {
      console.error("[ERROR] configureProvider", providerInstanceId);
      const decoded: ProviderConfig = decode(req.config!.msgpack);

      const result = await Effect.runPromise(args.configure(decoded), {
        signal: ctx.signal,
      });
      state = result.$state;
      return result;
    },
  };
};
