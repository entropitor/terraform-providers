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
import {
  Diagnostic_Severity,
  Schema_Attribute,
  Schema_Object_NestingMode,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import {
  decode as msgpackDecode,
  encode as msgpackEncode,
  ExtensionCodec,
} from "@msgpack/msgpack";
import type { PartialMessage } from "@bufbuild/protobuf";

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

class HashiCupsApiClient {
  private readonly host: string;
  private readonly token: string;

  constructor(host: string, token: string) {
    this.host = host;
    this.token = token;
  }

  static async signin(config: {
    host: string;
    username: string;
    password: string;
  }) {
    const response = await fetch(new URL("/signin", config.host), {
      method: "POST",
      body: JSON.stringify({
        username: config.username,
        password: config.password,
      }),
    });
    if (!response.ok) {
      throw new Error("Could not sign in with these credentials");
    }

    const json: any = await response.json();
    return new HashiCupsApiClient(config.host, json.token);
  }

  async coffees() {
    const response = await fetch(new URL("/coffees", this.host));
    if (!response.ok) {
      throw new Error("Could not get coffees");
    }

    const json: any = await response.json();
    return json;
  }

  async getOrder(id: number) {
    const response = await fetch(new URL(`/orders/${id}`, this.host), {
      headers: {
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not get order: ${await response.text()}`);
    }

    const json: any = await response.json();
    return json;
  }

  async createOrder(data: unknown) {
    const response = await fetch(new URL(`/orders`, this.host), {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not get order: ${await response.text()}`);
    }

    const json: any = await response.json();
    return json;
  }

  async updateOrder(id: number, data: unknown) {
    const response = await fetch(new URL(`/orders/${id}`, this.host), {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not update order: ${await response.text()}`);
    }

    const json: any = await response.json();
    return json;
  }

  async deleteOrder(id: number) {
    const response = await fetch(new URL(`/orders/${id}`, this.host), {
      method: "DELETE",
      headers: {
        Authorization: this.token,
      },
    });
    if (!response.ok) {
      throw new Error(`Could not delete order: ${await response.text()}`);
    }
  }
}

let client: HashiCupsApiClient | null = null;
const COFFEE_ATTRIBUTES: PartialMessage<Schema_Attribute>[] = [
  {
    name: "collection",
    type: Buffer.from('"string"'),
    computed: true,
  },
  {
    name: "color",
    type: Buffer.from('"string"'),
    computed: true,
  },
  {
    name: "description",
    type: Buffer.from('"string"'),
    computed: true,
  },
  {
    name: "id",
    type: Buffer.from('"number"'),
    computed: true,
  },
  {
    name: "image",
    type: Buffer.from('"string"'),
    computed: true,
  },
  {
    name: "ingredients",
    nestedType: {
      nesting: Schema_Object_NestingMode.LIST,
      attributes: [
        {
          name: "ingredient_id",
          type: Buffer.from('"number"'),
          computed: true,
        },
      ],
    },
    computed: true,
  },
  {
    name: "name",
    type: Buffer.from('"string"'),
    computed: true,
  },
  {
    name: "origin",
    type: Buffer.from('"string"'),
    computed: true,
  },
  {
    name: "price",
    type: Buffer.from('"number"'),
    computed: true,
  },
  {
    name: "teaser",
    type: Buffer.from('"string"'),
    computed: true,
  },
];
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
        const decoded = decode(req.config!.msgpack);

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
        const decoded = decode(req.config!.msgpack);
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
          provider: {
            block: {
              attributes: [
                {
                  name: "host",
                  type: Buffer.from('"string"'),
                  optional: true,
                },
                {
                  name: "username",
                  type: Buffer.from('"string"'),
                  optional: true,
                },
                {
                  name: "password",
                  type: Buffer.from('"string"'),
                  optional: true,
                },
              ],
            },
          },
          resourceSchemas: {
            hashicups_order: {
              block: {
                attributes: [
                  {
                    name: "id",
                    type: Buffer.from('"number"'),
                    computed: true,
                  },
                  {
                    name: "last_updated",
                    type: Buffer.from('"string"'),
                    computed: true,
                  },
                  {
                    name: "items",
                    required: true,
                    nestedType: {
                      nesting: Schema_Object_NestingMode.LIST,
                      attributes: [
                        {
                          name: "coffee",
                          required: true,
                          nestedType: {
                            nesting: Schema_Object_NestingMode.SINGLE,
                            attributes: [
                              {
                                name: "id",
                                required: true,
                                type: Buffer.from('"number"'),
                              },
                              {
                                name: "collection",
                                computed: true,
                                type: Buffer.from('"string"'),
                              },
                              {
                                name: "color",
                                computed: true,
                                type: Buffer.from('"string"'),
                              },
                              {
                                name: "description",
                                computed: true,
                                type: Buffer.from('"string"'),
                              },
                              {
                                name: "image",
                                computed: true,
                                type: Buffer.from('"string"'),
                              },
                              {
                                name: "ingredients",
                                computed: true,
                                nestedType: {
                                  nesting: Schema_Object_NestingMode.LIST,
                                  attributes: [
                                    {
                                      name: "ingredient_id",
                                      computed: true,
                                      type: Buffer.from('"number"'),
                                    },
                                  ],
                                },
                              },
                              {
                                name: "name",
                                computed: true,
                                type: Buffer.from('"string"'),
                              },
                              {
                                name: "origin",
                                computed: true,
                                type: Buffer.from('"string"'),
                              },
                              {
                                name: "price",
                                computed: true,
                                type: Buffer.from('"number"'),
                              },
                              {
                                name: "teaser",
                                computed: true,
                                type: Buffer.from('"string"'),
                              },
                            ],
                          },
                        },
                        {
                          name: "quantity",
                          required: true,
                          type: Buffer.from('"number"'),
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
          dataSourceSchemas: {
            hashicups_coffees: {
              block: {
                description: "All the coffees our coffee shop has",
                attributes: [
                  {
                    name: "coffees",
                    computed: true,
                    description: "The list of coffees",
                    nestedType: {
                      nesting: Schema_Object_NestingMode.LIST,
                      attributes: COFFEE_ATTRIBUTES,
                    },
                  },
                ],
              },
            },
            hashicups_order: {
              block: {
                attributes: [
                  { name: "id", type: Buffer.from('"number"'), required: true },
                  {
                    name: "items",
                    computed: true,
                    nestedType: {
                      nesting: Schema_Object_NestingMode.LIST,
                      attributes: [
                        {
                          name: "coffee",
                          nestedType: {
                            nesting: Schema_Object_NestingMode.SINGLE,
                            attributes: COFFEE_ATTRIBUTES,
                          },
                          computed: true,
                        },
                        {
                          name: "quantity",
                          type: Buffer.from('"number"'),
                          computed: true,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
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
