import type { ConfigFor, Schema, StateFor } from "./attributes.js";
import { Effect } from "effect";
import { decode, encodeWithSchema } from "./codec.js";
import type { HandlerContext } from "@connectrpc/connect";
import type {
  ReadDataSource_Request,
  ValidateDataResourceConfig_Request,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";
import type { ProviderForResources } from "./provider.js";
import {
  DiagnosticError,
  withDiagnostics,
  type Diagnostics,
} from "./diagnostics.js";
import { preValidateSchema } from "./pre-validate.js";

interface ReadRequest<TDataSourceSchema extends Schema> {
  config: ConfigFor<TDataSourceSchema>;
}
interface ReadResponse<TDataSourceSchema extends Schema> {
  state: StateFor<TDataSourceSchema>;
}

interface ValidateRequest<TDataSourceSchema extends Schema> {
  config: ConfigFor<TDataSourceSchema>;
}
interface ValidateResponse<_TDataSourceSchema extends Schema> {}

export interface IDataSource<TDataSourceSchema extends Schema, TProviderState> {
  schema: TDataSourceSchema;

  validate?: (
    req: NoInfer<ValidateRequest<TDataSourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    void | NoInfer<ValidateResponse<TDataSourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
  read: (
    req: NoInfer<ReadRequest<TDataSourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<ReadResponse<TDataSourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;
}

export type DataSource = ReturnType<typeof createDataSource>;

export const createDataSource = <TDataSourceSchema extends Schema, TState>(
  provider: ProviderForResources<TState>,
  datasource: IDataSource<TDataSourceSchema, TState>,
) => {
  type DataSourceConfig = ConfigFor<TDataSourceSchema>;

  return {
    schema: datasource.schema,

    async validateDataResourceConfig(
      req: ValidateDataResourceConfig_Request,
      ctx: HandlerContext,
    ) {
      console.error(
        "[ERROR] validateDataResourceConfig",
        provider.providerInstanceId,
      );

      const config: DataSourceConfig = decode(req.config!.msgpack);
      return await Effect.runPromise(
        Effect.gen(function* () {
          yield* preValidateSchema(config, datasource.schema);

          if (datasource.validate === undefined) {
            return {};
          }

          return yield* datasource
            .validate({ config }, provider.state)
            .pipe(Effect.map(() => ({})));
        }).pipe(withDiagnostics()),
        { signal: ctx.signal },
      );
    },
    async readDataSource(req: ReadDataSource_Request, ctx: HandlerContext) {
      console.error("[ERROR] readDataSource", provider.providerInstanceId);
      const config: DataSourceConfig = decode(req.config!.msgpack);
      return await Effect.runPromise(
        datasource.read({ config }, provider.state).pipe(
          Effect.map((resp) => ({
            state: {
              msgpack: encodeWithSchema(resp.state, datasource.schema),
            },
          })),
          withDiagnostics(),
        ),
        { signal: ctx.signal },
      );
    },
  };
};
