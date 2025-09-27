import type { ResourceUri } from "@atcute/lexicons";
import { attributeType, transform } from "@entropitor/terraform-provider-sdk";

export const messageFrom = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error occurred";
};

export type Did = `did:plc:${string}` | `did:web:${string}`;
export type Handle = `${string}.${string}`;
export type DidOrHandle = Did | Handle;

export const didStringAttribute = transform(
  attributeType.string,
  (s) => s as `did:${string}:${string}`,
);

export const didOrHandleAttribute = transform(
  attributeType.string,
  (s) => s as DidOrHandle,
);
export const didAttribute = transform(attributeType.string, (s) => s as Did);
export const handleAttribute = transform(
  attributeType.string,
  (s) => s as Handle,
);

export const urlAttribute = transform(
  attributeType.string,
  (s) => s as `${string}:${string}`,
);
export const atUrlAttribute = transform(
  attributeType.string,
  (s) => s as ResourceUri,
);
