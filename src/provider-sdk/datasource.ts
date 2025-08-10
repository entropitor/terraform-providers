import type { ConfigFor, Schema, StateFor } from "./attributes.js";
import { Effect } from "effect";
import { decode, encodeWithSchema } from "./codec.js";
import type { HandlerContext } from "@connectrpc/connect";
import type { PartialMessage } from "@bufbuild/protobuf";
import type {
  ReadDataSource_Request,
  ValidateDataResourceConfig_Request,
  ValidateDataResourceConfig_Response,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import type { ProviderForResources } from "./provider.js";
import { withDiagnostics, type Diagnostics } from "./diagnostics.js";

interface ReadRequest<TDataSourceSchema extends Schema> {
  config: ConfigFor<TDataSourceSchema>;
}
interface ReadResponse<TDataSourceSchema extends Schema> {
  state: StateFor<TDataSourceSchema>;
}

export interface IDataSource<TDataSourceSchema extends Schema, TProviderState> {
  schema: TDataSourceSchema;
  validate: (
    config: ConfigFor<TDataSourceSchema>,
    providerState: TProviderState,
  ) => Effect.Effect<PartialMessage<ValidateDataResourceConfig_Response>>;
  read: (
    req: NoInfer<ReadRequest<TDataSourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<ReadResponse<TDataSourceSchema>>,
    never,
    Diagnostics
  >;
}

export type DataSource = ReturnType<typeof datasource>;

export const datasource = <TDataSourceSchema extends Schema, TState>(
  provider: ProviderForResources<TState>,
  args: IDataSource<TDataSourceSchema, TState>,
) => {
  type DataSourceConfig = ConfigFor<TDataSourceSchema>;

  return {
    schema: args.schema,

    async validateDataResourceConfig(
      req: ValidateDataResourceConfig_Request,
      ctx: HandlerContext,
    ) {
      console.error(
        "[ERROR] validateDataResourceConfig",
        provider.providerInstanceId,
      );
      const config: DataSourceConfig = decode(req.config!.msgpack);
      return await Effect.runPromise(args.validate(config, provider.state), {
        signal: ctx.signal,
      });
    },
    async readDataSource(req: ReadDataSource_Request, ctx: HandlerContext) {
      console.error("[ERROR] readDataSource", provider.providerInstanceId);
      const config: DataSourceConfig = decode(req.config!.msgpack);
      return await Effect.runPromise(
        args.read({ config }, provider.state).pipe(
          Effect.map((resp) => ({
            state: {
              msgpack: encodeWithSchema(resp.state, args.schema),
            },
          })),
          withDiagnostics(),
        ),
        { signal: ctx.signal },
      );
    },
  };
};
