/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  ExtensionCodec,
  decode as msgpackDecode,
  encode as msgpackEncode,
} from "@msgpack/msgpack";

import {
  type Attribute,
  type Fields,
  type Schema,
  UnionAttribute,
} from "./attributes.js";
import { unreachable } from "./utils/unreachable.js";

export class Unknown {
  _unknown = "UnknownValue";

  // @ts-expect-error unused argument
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
export const decode = (
  value: ArrayBufferLike | ArrayBufferView | ArrayLike<number>,
) => msgpackDecode(value, { extensionCodec }) as any;

const mapObject = (value: any, fields: Fields) => {
  if (value == null || value instanceof Unknown) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(fields).flatMap(([fieldName, field]) => {
      if (field instanceof UnionAttribute) {
        return field.alternatives.flatMap(
          (alternative: UnionAttribute["alternatives"][number]) =>
            Object.entries(mapObject(value, alternative)),
        );
      }
      return [[fieldName, mapAttribute(value[fieldName], field)]];
    }),
  );
};
const mapAttribute = (value: any, attribute: Attribute): unknown => {
  switch (attribute.type) {
    case "boolean":
    case "custom":
    case "number":
    case "string":
      return value;
    case "list":
      if (value == null || value instanceof Unknown) {
        return value;
      }
      return value.map((item: any) => mapObject(item, attribute.fields));
    case "object":
      return mapObject(value, attribute.fields);
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
