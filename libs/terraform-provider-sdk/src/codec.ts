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
type Decodable = ArrayBufferLike | ArrayBufferView | ArrayLike<number>;
export const decode = (value: Decodable) =>
  msgpackDecode(value, { extensionCodec }) as any;

const encodeObject = (value: any, fields: Fields) => {
  if (value == null || value instanceof Unknown) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(fields).flatMap(([fieldName, field]) => {
      if (field instanceof UnionAttribute) {
        return field.alternatives.flatMap(
          (alternative: UnionAttribute["alternatives"][number]) =>
            Object.entries(encodeObject(value, alternative)),
        );
      }
      return [[fieldName, encodeAttribute(value[fieldName], field)]];
    }),
  );
};
const getTypeOf = (value: any): any => {
  // ["object",{"$type":"string","createdAt":"string","status":"string"}]
  switch (typeof value) {
    case "boolean":
      return "bool";
    case "number":
    case "string":
      return typeof value;
    case "object":
      if (Array.isArray(value)) {
        return ["list", getTypeOf(value[0])];
      }
      if (value instanceof Set) {
        return ["set", getTypeOf(value.values().next().value)];
      }
      return [
        "object",
        Object.fromEntries(
          Object.entries(value).map(([key, childValue]) => [
            key,
            getTypeOf(childValue),
          ]),
        ),
      ];
  }
};
const encodeAttribute = (value: any, attribute: Attribute): unknown => {
  switch (attribute.type) {
    case "any": {
      const type = getTypeOf(value);
      return [Buffer.from(JSON.stringify(type)), value];
    }
    case "array":
    case "boolean":
    case "custom":
    case "number":
    case "string":
      return value;
    case "list":
      if (value == null || value instanceof Unknown) {
        return value;
      }
      return value.map((item: any) => encodeObject(item, attribute.fields));
    case "object":
      return encodeObject(value, attribute.fields);
    default:
      return unreachable(attribute);
  }
};

export const encodeWithSchema = (state: unknown, schema: Schema) => {
  return encode(encodeObject(state, schema.attributes));
};

const postDecodeObject = (value: any, fields: Fields) => {
  if (value == null || value instanceof Unknown) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(fields).flatMap(([fieldName, field]) => {
      if (field instanceof UnionAttribute) {
        return field.alternatives.flatMap(
          (alternative: UnionAttribute["alternatives"][number]) =>
            Object.entries(postDecodeObject(value, alternative)),
        );
      }
      return [[fieldName, postDecodeAttribute(value[fieldName], field)]];
    }),
  );
};
const postDecodeAttribute = (value: any, attribute: Attribute): unknown => {
  switch (attribute.type) {
    case "any":
      // First entry in the tuple is the type
      return value[1];
    case "array":
    case "boolean":
    case "custom":
    case "number":
    case "string":
      return value;
    case "list":
      if (value == null || value instanceof Unknown) {
        return value;
      }
      return value.map((item: any) => postDecodeObject(item, attribute.fields));
    case "object":
      return postDecodeObject(value, attribute.fields);
    default:
      return unreachable(attribute);
  }
};

export const decodeWithSchema = (buffer: Decodable, schema: Schema) => {
  return postDecodeObject(decode(buffer), schema.attributes);
};
