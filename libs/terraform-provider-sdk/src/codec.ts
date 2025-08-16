import {
  ExtensionCodec,
  encode as msgpackEncode,
  decode as msgpackDecode,
} from "@msgpack/msgpack";
import {
  UnionAttribute,
  type Attribute,
  type Fields,
  type Schema,
} from "./attributes.js";
import { unreachable } from "./utils/unreachable.js";

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
const encode = (value: unknown) => msgpackEncode(value, { extensionCodec });
export const decode = (
  value: ArrayBufferLike | ArrayLike<number> | ArrayBufferView<ArrayBufferLike>,
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
    case "string":
    case "number":
    case "boolean":
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
