import type { ConfigFor, Schema } from "./attributes.js";
import { toTerraformSchema } from "./attributes.js";
import { Effect } from "effect";
import { decode, Unknown } from "./codec.js";
import {
  createDataSource,
  type DataSource,
  type IDataSource,
} from "./datasource.js";
import { createResource, type IResource, type Resource } from "./resource.js";
import { serveProvider } from "./serve.js";
import {
  DiagnosticError,
  withDiagnostics,
  type Diagnostics,
} from "./diagnostics.js";
import { preValidateSchema } from "./pre-validate.js";

interface ValidateRequest<TProviderSchema extends Schema> {
  config: ConfigFor<TProviderSchema>;
}
interface ValidateResponse<_TProviderSchema extends Schema> {}

interface ConfigureRequest<TProviderSchema extends Schema> {
  config: ConfigFor<TProviderSchema>;
}
interface ConfigureResponse<TInternalState> {
  $state: TInternalState;
}

export interface IProvider<
  TProviderSchema extends Schema,
  TInternalState,
  TName extends string,
> {
  name: TName;
  schema: TProviderSchema;
  configure: (
    req: NoInfer<ConfigureRequest<TProviderSchema>>,
  ) => Effect.Effect<
    ConfigureResponse<TInternalState>,
    DiagnosticError,
    Diagnostics
  >;
  validate: (
    req: NoInfer<ValidateRequest<TProviderSchema>>,
  ) => Effect.Effect<
    void | NoInfer<ValidateResponse<TProviderSchema>>,
    DiagnosticError,
    Diagnostics
  >;
}

export interface ProviderForResources<TState> {
  state: TState;
  providerInstanceId: number;
}

class ProviderBuilder<
  TProviderSchema extends Schema,
  TInternalState,
  TName extends string,
> {
  constructor(
    readonly provider: IProvider<TProviderSchema, TInternalState, TName>,
  ) {}

  resource<TResourceSchema extends Schema>(
    resource: IResource<TResourceSchema, TInternalState>,
  ) {
    return resource;
  }
  datasource<TDataSourceSchema extends Schema>(
    datasource: IDataSource<TDataSourceSchema, TInternalState>,
  ) {
    return datasource;
  }

  serve(args: {
    resources: Record<string, IResource<any, TInternalState>>;
    datasources: Record<string, IDataSource<any, TInternalState>>;
  }): void {
    const providerInstanceId = Math.floor(Math.random() * 1000);
    type ProviderConfig = ConfigFor<TProviderSchema>;

    let internalState: TInternalState = undefined as any;

    const providerInput = {
      get state() {
        return internalState;
      },
      providerInstanceId,
    };

    const datasources: Record<string, DataSource> = Object.fromEntries(
      Object.entries(args.datasources).map(([name, datasourceInput]) => [
        name,
        createDataSource(providerInput, datasourceInput),
      ]),
    );
    const resources: Record<string, Resource> = Object.fromEntries(
      Object.entries(args.resources).map(([name, resourceInput]) => [
        name,
        createResource(providerInput, resourceInput),
      ]),
    );

    const provider = this.provider;

    return serveProvider({
      shutdown() {
        console.error("[ERROR] Shutdown", providerInstanceId);
        console.error("[ERROR]");
        process.exit(0);
      },

      getProviderSchema() {
        console.error("[ERROR] getProviderSchema", providerInstanceId);
        return {
          provider: toTerraformSchema(provider.schema),
          resourceSchemas: Object.fromEntries(
            Object.entries(resources).map(([name, resource]) => [
              name,
              toTerraformSchema(resource.schema),
            ]),
          ),
          dataSourceSchemas: Object.fromEntries(
            Object.entries(datasources).map(([name, datasource]) => [
              name,
              toTerraformSchema(datasource.schema),
            ]),
          ),
        };
      },

      async validateProviderConfig(req, ctx) {
        console.error("[ERROR] validateProviderConfig", providerInstanceId);
        const config: ProviderConfig = decode(req.config!.msgpack);

        // This happens during terraform tests, not sure if it happens in normal usage
        if (Object.values(config).every((value) => value instanceof Unknown)) {
          return {};
        }

        return await Effect.runPromise(
          Effect.gen(function* () {
            yield* preValidateSchema(config, provider.schema);

            if (provider.validate == null) {
              return {};
            }

            return yield* provider
              .validate({ config })
              .pipe(Effect.map(() => ({})));
          }).pipe(withDiagnostics()),
          { signal: ctx.signal },
        );
      },
      async configureProvider(req, ctx) {
        console.error("[ERROR] configureProvider", providerInstanceId);

        const config: ProviderConfig = decode(req.config!.msgpack);
        const result = await Effect.runPromise(
          provider.configure({ config }).pipe(
            withDiagnostics(),
            Effect.tapDefect((defect) =>
              Effect.gen(function* () {
                console.error("[ERROR] configureProvider defect", defect);
              }),
            ),
          ),
          { signal: ctx.signal },
        );
        // @ts-expect-error: We don't know the type of result
        internalState = result.$state;
        return result;
      },

      async validateDataResourceConfig(req, ctx) {
        const datasource = datasources[req.typeName];
        return datasource!.validateDataResourceConfig(req, ctx);
      },
      async readDataSource(req, ctx) {
        const datasource = datasources[req.typeName];
        return datasource!.readDataSource(req, ctx);
      },

      async validateResourceConfig(req, ctx) {
        const resource = resources[req.typeName];
        return resource!.validateResourceConfig(req, ctx);
      },
      async planResourceChange(req, ctx) {
        const resource = resources[req.typeName];
        return resource!.planResourceChange(req, ctx);
      },
      async applyResourceChange(req, ctx) {
        const resource = resources[req.typeName];
        return resource!.applyResourceChange(req, ctx);
      },
      async readResource(req, ctx) {
        const resource = resources[req.typeName];
        return resource!.readResource(req, ctx);
      },
      async importResourceState(req, ctx) {
        const resource = resources[req.typeName];
        return resource!.importResource(req, ctx);
      },
      upgradeResourceState(req) {
        console.error("[ERROR] upgradeResourceState", providerInstanceId);
        return {
          upgradedState: { json: req.rawState!.json },
        };
      },
    });
  }
}

export const providerBuilder = <
  TProviderSchema extends Schema,
  TInternalState,
  TName extends string,
>(
  args: IProvider<TProviderSchema, TInternalState, TName>,
) => {
  return new ProviderBuilder(args);
};
