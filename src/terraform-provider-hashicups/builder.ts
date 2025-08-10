import { Effect } from "effect";
import { Diagnostic_Severity } from "../gen/tfplugin6/tfplugin6.7_pb.js";
import { schema, tf } from "../provider-sdk/attributes.js";
import { providerBuilder } from "../provider-sdk/provider.js";
import { HashiCupsApiClient } from "./HashiCupsApiClient.js";

export const hashicupsProviderBuilder = providerBuilder({
  name: "hashicups",
  schema: schema({
    host: tf.optional.string(),
    username: tf.optional.string(),
    password: tf.optional.string(),
  }),

  configure(config) {
    return Effect.promise(async () => {
      try {
        return { $state: await HashiCupsApiClient.signin(config) };
      } catch (error: any) {
        return {
          $state: null! as HashiCupsApiClient,
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
    });
  },

  validate({ config: _config }) {
    return Effect.promise(async () => {
      return {};
      // if (!config.host.startsWith("https://")) {
      //   return {
      //     diagnostics: [
      //       {
      //         severity: Diagnostic_Severity.WARNING,
      //         summary: "Unsafe protocol",
      //         detail:
      //           "You are using an unsafe protocol. It will be better if you would set this to https://",
      //         attribute: {
      //           steps: [
      //             { selector: { case: "attributeName", value: "host" } },
      //           ],
      //         },
      //       },
      //     ],
      //   };
      // }
    });
  },
});
