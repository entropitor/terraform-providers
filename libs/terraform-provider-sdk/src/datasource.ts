/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { HandlerContext } from "@connectrpc/connect";
import { Effect } from "effect";

import type { ConfigFor, Schema, StateFor } from "./attributes.js";
import { decodeWithSchema, encodeWithSchema } from "./codec.js";
import type { DiagnosticError } from "./diagnostics.js";
import { type Diagnostics, withDiagnostics } from "./diagnostics.js";
import type {
  ReadDataSource_Request,
  ValidateDataResourceConfig_Request,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";
import { preValidateSchema } from "./pre-validate.js";
import type { ProviderForResources } from "./provider.js";

type ReadRequest<TDataSourceSchema extends Schema> = {
  config: ConfigFor<TDataSourceSchema>;
};
type ReadResponse<TDataSourceSchema extends Schema> = {
  state: StateFor<TDataSourceSchema>;
};

type ValidateRequest<TDataSourceSchema extends Schema> = {
  config: ConfigFor<TDataSourceSchema>;
};
type ValidateResponse<_TDataSourceSchema extends Schema> = {};

export type IDataSource<TDataSourceSchema extends Schema, TProviderState> = {
  read: (
    req: NoInfer<ReadRequest<TDataSourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<ReadResponse<TDataSourceSchema>>,
    DiagnosticError,
    Diagnostics
  >;

  schema: TDataSourceSchema;
  validate?: (
    req: NoInfer<ValidateRequest<TDataSourceSchema>>,
    providerState: TProviderState,
  ) => Effect.Effect<
    NoInfer<ValidateResponse<TDataSourceSchema>> | void,
    DiagnosticError,
    Diagnostics
  >;
};

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

      const config: DataSourceConfig = decodeWithSchema(
        req.config!.msgpack,
        datasource.schema,
      );
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
      const config: DataSourceConfig = decodeWithSchema(
        req.config!.msgpack,
        datasource.schema,
      );
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
