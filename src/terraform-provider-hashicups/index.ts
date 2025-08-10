import type { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import http from "node:http2";
import forge from "node-forge";

import { Health } from "../gen/grpc/health/v1/health_connect.js";
import { HealthCheckResponse_ServingStatus } from "../gen/grpc/health/v1/health_pb.js";
import { GRPCStdio } from "../gen/plugin/grpc_stdio_connect.js";
import { Provider } from "../gen/tfplugin6/tfplugin6.7_connect.js";
import { generateIdentity } from "../certificate.js";
import { GRPCController } from "../gen/plugin/grpc_controller_connect.js";
import { Diagnostic_Severity } from "../gen/tfplugin6/tfplugin6.7_pb.js";
import {
  decode as msgpackDecode,
  encode as msgpackEncode,
  ExtensionCodec,
} from "@msgpack/msgpack";
import { HashiCupsApiClient } from "./HashiCupsApiClient.js";
import {
  schema,
  tf,
  toTerraformSchema,
  withDescription,
  type ConfigFor,
} from "./attributes.js";

class Unknown {
  _unknown = "UnknownValue";

  // @ts-expect-error unused
  constructor(private readonly buffer?: Buffer | Uint8Array) {}
}
const extensionCodec = new ExtensionCodec();

extensionCodec.register({
  type: 0,
  encode: (object) => {
    if (object instanceof Unknown) {
      return encode([]);
    }
    return null;
  },
  decode: (data) => {
    return new Unknown(data);
  },
});

const encode = (value: unknown) => msgpackEncode(value, { extensionCodec });
const decode = (value: unknown) =>
  msgpackDecode(value, { extensionCodec }) as any;

const providerInstanceId = Math.floor(Math.random() * 1000);

let client: HashiCupsApiClient | null = null;

const coffeeAttributes = {
  collection: tf.computed.string(),
  color: tf.computed.string(),
  description: tf.computed.string(),
  id: tf.computed.number(),
  image: tf.computed.string(),
  ingredients: tf.computed.list({
    ingredient_id: tf.computed.number(),
  }),
  name: tf.computed.string(),
  origin: tf.computed.string(),
  price: tf.computed.number(),
  teaser: tf.computed.string(),
};

const providerSchema = {
  provider: schema({
    host: tf.optional.string(),
    username: tf.optional.string(),
    password: tf.optional.string(),
  }),
  resourceSchemas: {
    hashicups_order: schema({
      id: tf.computed.number(),
      last_updated: tf.computed.string(),
      items: tf.required.list({
        coffee: tf.required.object({
          id: tf.required.number(),
          collection: tf.computed.string(),
          color: tf.computed.string(),
          description: tf.computed.string(),
          image: tf.computed.string(),
          ingredients: tf.computed.list({
            ingredient_id: tf.computed.number(),
          }),
          name: tf.computed.string(),
          origin: tf.computed.string(),

          price: tf.computed.number(),
          teaser: tf.computed.string(),
        }),
        quantity: tf.required.number(),
      }),
    }),
  },
  dataSourceSchemas: {
    hashicups_coffees: schema({
      coffees: tf.computed
        .list(coffeeAttributes)
        .pipe(withDescription("The list of coffees")),
    }).pipe(withDescription("All the coffees our coffee shop has")),
    hashicups_order: schema({
      id: tf.required.number(),
      items: tf.computed.list({
        coffee: tf.computed.object(coffeeAttributes),
        quantity: tf.computed.number(),
      }),
    }),
  },
};

type ProviderConfig = ConfigFor<typeof providerSchema.provider>;
const routes = (router: ConnectRouter) =>
  router
    .service(Provider, {
      async importResourceState(req) {
        console.error("[ERROR] importResourceState", providerInstanceId);

        const order = await client!.getOrder(parseInt(req.id, 10));
        return {
          importedResources: [
            {
              typeName: req.typeName,
              state: {
                msgpack: encode({
                  ...order,
                  last_updated: null,
                }),
              },
            },
          ],
        };
      },
      async configureProvider(req) {
        console.error("[ERROR] configureProvider", providerInstanceId);
        const decoded: ProviderConfig = decode(req.config!.msgpack);

        try {
          client = await HashiCupsApiClient.signin(decoded);
          return {};
        } catch (error: any) {
          return {
            diagnostics: [
              {
                detail: error.message,
                summary: "Invalid credentials",
                severity: Diagnostic_Severity.ERROR,
                attribute: {
                  steps: [
                    { selector: { case: "attributeName", value: "password" } },
                  ],
                },
              },
            ],
          };
        }
      },
      async readDataSource(req) {
        console.error("[ERROR] readDataSource", providerInstanceId);
        const config = decode(req.config!.msgpack);
        try {
          switch (req.typeName) {
            case "hashicups_coffees":
              return {
                state: {
                  msgpack: encode({
                    coffees: await client!.coffees(),
                  }),
                },
              };
            case "hashicups_order":
              return {
                state: {
                  msgpack: encode(await client!.getOrder(config.id)),
                },
              };
            default:
              throw new Error("Unknown data source");
          }
        } catch (error: any) {
          return {
            diagnostics: [
              {
                detail: error.message,
                summary: "Error while reading resource",
                severity: Diagnostic_Severity.ERROR,
              },
            ],
          };
        }
      },
      validateProviderConfig(req) {
        console.error("[ERROR] validateProviderConfig", providerInstanceId);
        const decoded: ProviderConfig = decode(req.config!.msgpack);
        if (!decoded.host.startsWith("https://")) {
          return {
            diagnostics: [
              // {
              //   severity: Diagnostic_Severity.WARNING,
              //   summary: "Unsafe protocol",
              //   detail:
              //     "You are using an unsafe protocol. It will be better if you would set this to https://",
              //   attribute: {
              //     steps: [
              //       { selector: { case: "attributeName", value: "host" } },
              //     ],
              //   },
              // },
            ],
          };
        }
        return {};
      },
      validateDataResourceConfig() {
        console.error("[ERROR] validateDataResourceConfig", providerInstanceId);
        return {};
      },
      validateResourceConfig() {
        console.error("[ERROR] validateResourceConfig", providerInstanceId);
        return {};
      },
      planResourceChange(req) {
        console.error("[ERROR] planResourceChange", providerInstanceId);

        try {
          const proposed = decode(req.proposedNewState?.msgpack);
          const prior = decode(req.priorState?.msgpack);

          const same =
            req.proposedNewState?.msgpack.length ==
              req.priorState?.msgpack.length &&
            req.proposedNewState?.msgpack.every(
              (byte, index) => byte == req.priorState?.msgpack[index],
            );
          if (!same) {
            proposed.id = new Unknown();
            proposed.last_updated = new Unknown();
            proposed.items.forEach((item: any) => {
              item.coffee.collection = new Unknown();
              item.coffee.color = new Unknown();
              item.coffee.description = new Unknown();
              item.coffee.image = new Unknown();
              item.coffee.ingredients = new Unknown();
              item.coffee.name = new Unknown();
              item.coffee.origin = new Unknown();
              item.coffee.price = new Unknown();
              item.coffee.teaser = new Unknown();
            });
          }

          if (prior?.id) {
            proposed.id = prior.id;
          }
          proposed.items.forEach((item: any, index: number) => {
            const priorItem = prior?.items?.[index];
            if (item.coffee?.id === priorItem?.coffee?.id) {
              item.coffee = priorItem.coffee;
            }
          });

          return {
            plannedState: { msgpack: encode(proposed) },
          };
        } catch (error) {
          return {
            diagnostics: [
              {
                severity: Diagnostic_Severity.ERROR,
                detail: error?.toString() ?? "Unknown error",
              },
            ],
          };
        }
      },
      async applyResourceChange(req) {
        console.error("[ERROR] applyResourceChange", providerInstanceId);

        const config = decode(req.config?.msgpack);
        const prior = decode(req.priorState?.msgpack);

        try {
          if (prior == null) {
            const order = await client!.createOrder(config.items);
            return {
              newState: {
                msgpack: encode({
                  ...order,
                  last_updated: new Date().toISOString(),
                }),
              },
            };
          } else if (config != null) {
            await client!.updateOrder(prior.id, config.items);
            const order = await client!.getOrder(prior.id);
            return {
              newState: {
                msgpack: encode({
                  ...order,
                  last_updated: new Date().toISOString(),
                }),
              },
            };
          } else {
            await client!.deleteOrder(prior.id);
            return {
              newState: { msgpack: encode(null) },
            };
          }
        } catch (error) {
          return {
            diagnostics: [
              {
                severity: Diagnostic_Severity.ERROR,
                detail: error?.toString() ?? "Unknown error",
              },
            ],
          };
        }
      },
      upgradeResourceState(req) {
        console.error("[ERROR] upgradeResourceState", providerInstanceId);
        return {
          upgradedState: { json: req.rawState!.json },
        };
      },
      async readResource(req) {
        console.error("[ERROR] readResource", providerInstanceId);
        try {
          const currentState = decode(req.currentState!.msgpack);
          if (currentState == null) {
            return { newState: { msgpack: encode(null) } };
          }
          return {
            newState: {
              msgpack: encode({
                ...currentState,
                ...(await client!.getOrder(currentState.id)),
              }),
            },
          };
        } catch (error) {
          return {
            diagnostics: [
              {
                severity: Diagnostic_Severity.ERROR,
                detail: error?.toString() ?? "Unknown error",
              },
            ],
          };
        }
      },
      getProviderSchema(_req) {
        console.error("[ERROR] getProviderSchema", providerInstanceId);
        return {
          provider: providerSchema.provider.toTerraformSchema(),
          resourceSchemas: Object.fromEntries(
            Object.entries(providerSchema.resourceSchemas).map(
              ([name, schema]) => [name, toTerraformSchema(schema)],
            ),
          ),
          dataSourceSchemas: Object.fromEntries(
            Object.entries(providerSchema.dataSourceSchemas).map(
              ([name, schema]) => [name, toTerraformSchema(schema)],
            ),
          ),
        };
      },
    })
    .service(GRPCController, {
      shutdown() {
        console.error("[ERROR] Shutdown", providerInstanceId);
        console.error("[ERROR]");
        process.exit(0);
      },
    })
    .service(Health, {
      check(_req) {
        return {
          status: HealthCheckResponse_ServingStatus.SERVING,
          stdio: HealthCheckResponse_ServingStatus.SERVING,
        };
      },
    })
    .service(GRPCStdio, {
      async *streamStdio(_req) {},
    });

if (
  process.env.TF_PLUGIN_MAGIC_COOKIE !==
  "d602bf8f470bc67ca7faa0386276bbdd4330efaf76d1a219cb4d6991ca9872b2"
) {
  console.error(
    "This binary is a plugin. These are not meant to be executed directly.\nPlease execute the program that consumes these plugins, which will\nload any plugins automatically",
  );
  process.exit(1);
}

if (process.env.PLUGIN_CLIENT_CERT == null) {
  throw new Error("No plugin client cert provided");
}

const { cert: serverCertificate, keys } = generateIdentity();
const cert = forge.pki.certificateToPem(serverCertificate);
const key = forge.pki.privateKeyToPem(keys.privateKey);

const serverCertificateString = forge.util
  .encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(serverCertificate)).getBytes(),
  )
  // Remove padding
  .replace(/=*$/, "");

const PORT = 4001;
http
  .createSecureServer({ cert, key }, connectNodeAdapter({ routes }))
  .listen(PORT);
console.log(`1|6|tcp|127.0.0.1:${PORT}|grpc|${serverCertificateString}`);

process.on("uncaughtException", (error) => console.error(error));
process.on("unhandledRejection", (error) => console.error(error));
