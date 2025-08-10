import type { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import http from "node:http2";
import forge from "node-forge";
import { decode, encode } from "msgpackr";

import { Health } from "./gen/grpc/health/v1/health_connect.js";
import { HealthCheckResponse_ServingStatus } from "./gen/grpc/health/v1/health_pb.js";
import { GRPCStdio } from "./gen/plugin/grpc_stdio_connect.js";
import { Provider } from "./gen/tfplugin6/tfplugin6.7_connect.js";
import { generateIdentity } from "./certificate.js";
import { GRPCController } from "./gen/plugin/grpc_controller_connect.js";
import {
  Diagnostic_Severity,
  Schema_Object_NestingMode,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";

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
}

let client: HashiCupsApiClient | null = null;
const COFFEE_ATTRIBUTES = [
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

        return {
          plannedState: req.proposedNewState!,
        };
      getProviderSchema(_req) {
        console.error("[ERROR] getProviderSchema", providerInstanceId);
        return {
          provider: {
            block: {
              attributes: [
                {
                  name: "host",
                  type: Buffer.from('"string"'),
                },
                {
                  name: "username",
                  type: Buffer.from('"string"'),
                },
                {
                  name: "password",
                  type: Buffer.from('"string"'),
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
                attributes: [
                  {
                    name: "coffees",
                    computed: true,
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
