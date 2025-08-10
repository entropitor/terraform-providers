import { Effect } from "effect";
import { schema, tf } from "../provider-sdk/attributes.js";
import { providerBuilder } from "../provider-sdk/provider.js";
import { HashiCupsApiClient } from "./HashiCupsApiClient.js";
import { Diagnostics, diagnosticsPath } from "../provider-sdk/diagnostics.js";

export const hashicupsProviderBuilder = providerBuilder({
  name: "hashicups",
  schema: schema({
    host: tf.required.string(),
    username: tf.required.string(),
    password: tf.required.string(),
  }),

  configure({ config }) {
    return Effect.gen(function* () {
      try {
        return {
          $state: yield* Effect.promise(() =>
            HashiCupsApiClient.signin(config),
          ),
        };
      } catch (error: any) {
        return yield* Diagnostics.crit(
          [diagnosticsPath.attribute("password")],
          "Invalid credentials",
          error.message,
        );
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
