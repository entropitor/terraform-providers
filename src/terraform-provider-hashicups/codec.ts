import {
  ExtensionCodec,
  encode as msgpackEncode,
  decode as msgpackDecode,
} from "@msgpack/msgpack";

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
