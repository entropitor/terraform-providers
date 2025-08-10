import type {
  ApplyResourceChange_Request,
  ConfigureProvider_Request,
  ConfigureProvider_Response,
  PlanResourceChange_Request,
  ReadDataSource_Request,
  ValidateProviderConfig_Request,
  ValidateProviderConfig_Response,
  ValidateResourceConfig_Request,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import type { ConfigFor, Schema } from "./attributes.js";
import { Effect } from "effect";
import { decode } from "./codec.js";
import type { HandlerContext } from "@connectrpc/connect";
import type { PartialMessage } from "@bufbuild/protobuf";
import { datasource, type DataSource, type IDataSource } from "./datasource.js";
import { resource, type IResource, type Resource } from "./resource.js";

interface IProvider<
  TProviderSchema extends Schema,
  TDataSourcesSchema extends Record<string, Schema>,
  TResourcesSchema extends Record<string, Schema>,
  TState,
  TName extends string,
> {
  name: TName;
  schema: TProviderSchema;
  configure: (
    config: ConfigFor<TProviderSchema>,
  ) => Effect.Effect<
    { $state: TState } & PartialMessage<ConfigureProvider_Response>
  >;
  validate: (
    config: ConfigFor<TProviderSchema>,
  ) => Effect.Effect<PartialMessage<ValidateProviderConfig_Response>>;

  datasources: {
    [TDataSourceName in keyof TDataSourcesSchema]: IDataSource<
      TDataSourcesSchema[TDataSourceName],
      NoInfer<TState>
    > /*&
      (TDataSourceName extends `${NoInfer<TName>}_${string}`
        ? object
        : {
            error: `Your data source name should start with ${TName}_`;
          })*/;
  };
  resources: {
    [TResourceName in keyof TResourcesSchema]: IResource<
      TResourcesSchema[TResourceName],
      NoInfer<TState>
    > /*&
      (TResourceName extends `${NoInfer<TName>}_${string}`
        ? object
        : {
            error: `Your resource name should start with ${TName}_`;
          })*/;
  };
}

export interface ProviderForResources<TState> {
  state: TState;
  providerInstanceId: number;
}

export const provider = <
  TProviderSchema extends Schema,
  TDataSourcesSchema extends Record<string, Schema>,
  TResourcesSchema extends Record<string, Schema>,
  TState,
  TName extends string,
>(
  args: IProvider<
    TProviderSchema,
    TDataSourcesSchema,
    TResourcesSchema,
    TState,
    TName
  >,
) => {
  const providerInstanceId = Math.floor(Math.random() * 1000);
  type ProviderConfig = ConfigFor<TProviderSchema>;

  let state: TState = undefined as any;

  const providerInput = {
    get state() {
      return state;
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

    async validateDataResourceConfig(
      req: ValidateResourceConfig_Request,
      ctx: HandlerContext,
    ) {
      const datasource = datasources[req.typeName];
      return datasource!.validateDataResourceConfig(req, ctx);
    },
    async readDataSource(req: ReadDataSource_Request, ctx: HandlerContext) {
      const datasource = datasources[req.typeName];
      return datasource!.readDataSource(req, ctx);
    },

    async validateResourceConfig(
      req: ValidateResourceConfig_Request,
      ctx: HandlerContext,
    ) {
      const resource = resources[req.typeName];
      return resource!.validateResourceConfig(req, ctx);
    },
    async planResourceChange(
      req: PlanResourceChange_Request,
      ctx: HandlerContext,
    ) {
      const resource = resources[req.typeName];
      return resource!.planResourceChange(req, ctx);
    },
    async applyResourceChange(
      req: ApplyResourceChange_Request,
      ctx: HandlerContext,
    ) {
      const resource = resources[req.typeName];
      return resource!.applyResourceChange(req, ctx);
    },
  };
};
