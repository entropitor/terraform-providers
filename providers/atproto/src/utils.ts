import type { ResourceUri } from "@atcute/lexicons";
import { attributeType, transform } from "@entropitor/terraform-provider-sdk";

export const didStringAttribute = transform(
  attributeType.string,
  (s) => s as `did:${string}:${string}`,
);

export const urlAttribute = transform(
  attributeType.string,
  (s) => s as `${string}:${string}`,
);
export const atUrlAttribute = transform(
  attributeType.string,
  (s) => s as ResourceUri,
);
