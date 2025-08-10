import {
  ExtensionCodec,
  encode as msgpackEncode,
  decode as msgpackDecode,
} from "@msgpack/msgpack";
import type { Attribute, Schema } from "./attributes.js";
import { unreachable } from "./unreachable.js";

export class Unknown {
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
export const encode = (value: unknown) =>
  msgpackEncode(value, { extensionCodec });
export const decode = (value: unknown) =>
  msgpackDecode(value, { extensionCodec }) as any;

const mapObject = (value: any, fields: Record<string, Attribute>) => {
  if (value == null || value instanceof Unknown) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(fields).map(([fieldName, field]) => {
      return [fieldName, mapAttribute(value[fieldName], field)];
    }),
  );
};
const mapAttribute = (value: any, attribute: Attribute): unknown => {
  switch (attribute.type) {
    case "string":
    case "number":
      return value;
    case "object":
      return mapObject(value, attribute.fields);
    case "list":
      if (value == null || value instanceof Unknown) {
        return value;
      }
      return value.map((item: any) => mapObject(item, attribute.fields));
    default:
      return unreachable(attribute);
  }
};
const mapSchema = (value: any, schema: Schema) => {
  return mapObject(value, schema.attributes);
};

export const encodeWithSchema = (state: unknown, schema: Schema) => {
  return encode(mapSchema(state, schema));
};
