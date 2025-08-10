import type { Schema } from "./attributes.js";

export const provider = <TProviderSchema extends Schema>(
  schema: TProviderSchema,
) => {
  return {
    providerSchema: schema,
  };
};
