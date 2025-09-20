/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Effect } from "effect";

import type { ConfigFor, Schema } from "./attributes.js";
import { toTerraformSchema } from "./attributes.js";
import { decodeWithSchema, Unknown } from "./codec.js";
import {
  createDataSource,
  type DataSource,
  type IDataSource,
} from "./datasource.js";
import type { DiagnosticError } from "./diagnostics.js";
import { type Diagnostics, withDiagnostics } from "./diagnostics.js";
import { preValidateSchema } from "./pre-validate.js";
import { createResource, type IResource, type Resource } from "./resource.js";
import { serveProvider } from "./serve.js";

type ValidateRequest<TProviderSchema extends Schema> = {
  config: ConfigFor<TProviderSchema>;
};
type ValidateResponse<_TProviderSchema extends Schema> = {};

type ConfigureRequest<TProviderSchema extends Schema> = {
  config: ConfigFor<TProviderSchema>;
};
type ConfigureResponse<TInternalState> = {
  $state: TInternalState;
};

export type IProvider<TProviderSchema extends Schema, TInternalState> = {
  configure: (
    req: NoInfer<ConfigureRequest<TProviderSchema>>,
  ) => Effect.Effect<
    ConfigureResponse<TInternalState>,
    DiagnosticError,
    Diagnostics
  >;
  schema: TProviderSchema;
  validate?: (
    req: NoInfer<ValidateRequest<TProviderSchema>>,
  ) => Effect.Effect<
    NoInfer<ValidateResponse<TProviderSchema>> | void,
    DiagnosticError,
    Diagnostics
  >;
};

export type ProviderForResources<TState> = {
  state: TState;
};

class ProviderBuilder<TProviderSchema extends Schema, TInternalState> {
  constructor(readonly provider: IProvider<TProviderSchema, TInternalState>) {}

  resource<TResourceSchema extends Schema>(
    resource: IResource<TResourceSchema, NoInfer<TInternalState>>,
  ) {
    return resource;
  }
  datasource<TDataSourceSchema extends Schema>(
    datasource: IDataSource<TDataSourceSchema, NoInfer<TInternalState>>,
  ) {
    return datasource;
  }

  serve(args: {
    name: string;
    resources: Record<string, IResource<any, NoInfer<TInternalState>>>;
    datasources: Record<string, IDataSource<any, NoInfer<TInternalState>>>;
  }): void {
    type ProviderConfig = ConfigFor<TProviderSchema>;

    let internalState: TInternalState = undefined as any;

    const providerInput = {
      get state() {
        return internalState;
      },
    };

    const providerPrefix = `${args.name}_`;

    const datasources: Record<string, DataSource> = Object.fromEntries(
      Object.entries(args.datasources).map(([name, datasourceInput]) => [
        providerPrefix + name,
        createDataSource(providerInput, datasourceInput),
      ]),
    );
    const resources: Record<string, Resource> = Object.fromEntries(
      Object.entries(args.resources).map(([name, resourceInput]) => [
        providerPrefix + name,
        createResource(providerInput, resourceInput),
      ]),
    );

    const provider = this.provider;

    serveProvider({
      getProviderSchema() {
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
        const config: ProviderConfig = decodeWithSchema(
          req.config!.msgpack,
          provider.schema,
        );

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
        const config: ProviderConfig = decodeWithSchema(
          req.config!.msgpack,
          provider.schema,
        );
        const result = await Effect.runPromise(
          provider.configure({ config }).pipe(withDiagnostics()),
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
        return {
          upgradedState: { json: req.rawState!.json },
        };
      },
    });
  }
}

export type ProviderStateFor<TProvider> =
  TProvider extends ProviderBuilder<any, infer TInternalState> ? TInternalState
  : never;

export const providerBuilder = <TProviderSchema extends Schema, TInternalState>(
  args: IProvider<TProviderSchema, TInternalState>,
) => {
  return new ProviderBuilder(args);
};
