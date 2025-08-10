import type {
  ConfigureProvider_Response,
  ValidateProviderConfig_Response,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import type { Provider as TerraformProvider } from "../gen/tfplugin6/tfplugin6.7_connect.js";
import type { ConfigFor, Schema } from "./attributes.js";
import { toTerraformSchema } from "./attributes.js";
import { Effect } from "effect";
import { decode } from "./codec.js";
import type { ServiceImpl } from "@connectrpc/connect";
import type { PartialMessage } from "@bufbuild/protobuf";
import { datasource, type DataSource, type IDataSource } from "./datasource.js";
import { resource, type IResource, type Resource } from "./resource.js";
import type { GRPCController } from "../gen/plugin/grpc_controller_connect.js";

interface IProvider<
  TProviderSchema extends Schema,
  TInternalState,
  TName extends string,
> {
  name: TName;
  schema: TProviderSchema;
  configure: (
    config: ConfigFor<TProviderSchema>,
  ) => Effect.Effect<
    { $state: TInternalState } & PartialMessage<ConfigureProvider_Response>
  >;
  validate: (
    config: ConfigFor<TProviderSchema>,
  ) => Effect.Effect<PartialMessage<ValidateProviderConfig_Response>>;
}

export interface ProviderForResources<TState> {
  state: TState;
  providerInstanceId: number;
}

export type BuiltProvider = Partial<ServiceImpl<typeof TerraformProvider>> &
  ServiceImpl<typeof GRPCController>;

class ProviderBuilder<
  TProviderSchema extends Schema,
  TInternalState,
  TName extends string,
> {
  constructor(
    readonly provider: {
      name: TName;
      schema: TProviderSchema;
      configure: (
        config: ConfigFor<TProviderSchema>,
      ) => Effect.Effect<
        { $state: TInternalState } & PartialMessage<ConfigureProvider_Response>
      >;
      validate: (
        config: ConfigFor<TProviderSchema>,
      ) => Effect.Effect<PartialMessage<ValidateProviderConfig_Response>>;
    },
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

  build(args: {
    resources: Record<string, IResource<any, TInternalState>>;
    datasources: Record<string, IDataSource<any, TInternalState>>;
  }): BuiltProvider {
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
        datasource(providerInput, datasourceInput),
      ]),
    );
    const resources: Record<string, Resource> = Object.fromEntries(
      Object.entries(args.resources).map(([name, resourceInput]) => [
        name,
        resource(providerInput, resourceInput),
      ]),
    );

    const provider = this.provider;

    return {
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
        const decoded: ProviderConfig = decode(req.config!.msgpack);
        return await Effect.runPromise(provider.validate(decoded), {
          signal: ctx.signal,
        });
      },
      async configureProvider(req, ctx) {
        console.error("[ERROR] configureProvider", providerInstanceId);
        const decoded: ProviderConfig = decode(req.config!.msgpack);

        const result = await Effect.runPromise(provider.configure(decoded), {
          signal: ctx.signal,
        });
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
    };
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
