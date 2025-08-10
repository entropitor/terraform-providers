import { unreachable } from "./unreachable.js";
import {
  Schema as TerraformSchema,
  Schema_Attribute,
  Schema_Object_NestingMode,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import { pipeArguments, type Pipeable } from "effect/Pipeable";
import type { PartialMessage } from "@bufbuild/protobuf";

type AttributeType =
  | { type: "string" }
  | { type: "number" }
  | { type: "list"; fields: Record<string, Attribute> }
  | { type: "object"; fields: Record<string, Attribute> };

type Presence = "required" | "computed" | "optional" | "computed_optional";

type Attribute = AttributeType & { presence: Presence } & {
  description?: string;
};

abstract class BaseAttribute implements Pipeable {
  public readonly description?: string;

  pipe<A>(this: A): A;
  pipe<A, B = never>(this: A, ab: (_: A) => B): B;
  pipe<A, B = never, C = never>(this: A, ab: (_: A) => B, bc: (_: B) => C): C;
  pipe<A, B = never, C = never, D = never>(
    this: A,
    ab: (_: A) => B,
    bc: (_: B) => C,
    cd: (_: C) => D,
  ): D;
  pipe<A, B = never, C = never, D = never, E = never>(
    this: A,
    ab: (_: A) => B,
    bc: (_: B) => C,
    cd: (_: C) => D,
    de: (_: D) => E,
  ): E;
  pipe() {
    return pipeArguments(this, arguments);
  }
}

class PrimitiveAttribute extends BaseAttribute {
  constructor(
    public readonly type: "string" | "number",
    public readonly presence: Presence,
  ) {
    super();
  }
}

class CompositeAttribute extends BaseAttribute {
  constructor(
    public readonly type: "list" | "object",
    public readonly presence: Presence,
    public readonly fields: Record<string, Attribute>,
  ) {
    super();
  }
}

const presenceFrom = (
  attr: Attribute,
): Pick<Schema_Attribute, "computed" | "required" | "optional"> => {
  switch (attr.presence) {
    case "required":
      return { required: true, optional: false, computed: false };
    case "computed":
      return { required: false, optional: false, computed: true };
    case "optional":
      return { required: false, optional: true, computed: false };
    case "computed_optional":
      return { required: false, optional: true, computed: true };
    default:
      return unreachable(attr.presence);
  }
};

const typeFrom = (
  attr: Attribute,
): Pick<PartialMessage<Schema_Attribute>, "type" | "nestedType"> => {
  switch (attr.type) {
    case "string":
      return { type: Buffer.from('"string"') };
    case "number":
      return { type: Buffer.from('"number"') };

    case "object":
      return {
        nestedType: {
          nesting: Schema_Object_NestingMode.SINGLE,
          attributes: attributeListFrom(attr.fields),
        },
      };
    case "list":
      return {
        nestedType: {
          nesting: Schema_Object_NestingMode.LIST,
          attributes: attributeListFrom(attr.fields),
        },
      };

    default:
      return unreachable(attr);
  }
};

export const attributeListFrom = (
  fields: Record<string, Attribute>,
): PartialMessage<Schema_Attribute>[] => {
  return Object.entries(fields).map(
    ([name, attr]): PartialMessage<Schema_Attribute> => {
      return {
        name,
        ...(attr.description ? { description: attr.description } : {}),
        ...presenceFrom(attr),
        ...typeFrom(attr),
      };
    },
  );
};

type Schema = {
  attributes: Record<string, Attribute>;
  description?: string;
};
export const toTerraformSchema = (
  schema: Schema,
): PartialMessage<TerraformSchema> => {
  return {
    block: {
      attributes: attributeListFrom(schema.attributes),
      ...(schema.description ? { description: schema.description } : {}),
    },
  };
};

class SchemaInternal implements Pipeable {
  constructor(public readonly attributes: Record<string, Attribute>) {}

  pipe<A>(this: A): A;
  pipe<A, B = never>(this: A, ab: (_: A) => B): B;
  pipe<A, B = never, C = never>(this: A, ab: (_: A) => B, bc: (_: B) => C): C;
  pipe<A, B = never, C = never, D = never>(
    this: A,
    ab: (_: A) => B,
    bc: (_: B) => C,
    cd: (_: C) => D,
  ): D;
  pipe<A, B = never, C = never, D = never, E = never>(
    this: A,
    ab: (_: A) => B,
    bc: (_: B) => C,
    cd: (_: C) => D,
    de: (_: D) => E,
  ): E;
  pipe() {
    return pipeArguments(this, arguments);
  }

  toTerraformSchema() {
    return toTerraformSchema(this);
  }
}

export const tf = {
  optional: {
    string: () => new PrimitiveAttribute("string", "optional"),
    number: () => new PrimitiveAttribute("number", "optional"),
    object: (fields: Record<string, Attribute>) =>
      new CompositeAttribute("object", "optional", fields),
    list: (fields: Record<string, Attribute>) =>
      new CompositeAttribute("list", "optional", fields),
  },
  required: {
    string: () => new PrimitiveAttribute("string", "required"),
    number: () => new PrimitiveAttribute("number", "required"),
    object: (fields: Record<string, Attribute>) =>
      new CompositeAttribute("object", "required", fields),
    list: (fields: Record<string, Attribute>) =>
      new CompositeAttribute("list", "required", fields),
  },
  computed: {
    string: () => new PrimitiveAttribute("string", "computed"),
    number: () => new PrimitiveAttribute("number", "computed"),
    object: (fields: Record<string, Attribute>) =>
      new CompositeAttribute("object", "computed", fields),
    list: (fields: Record<string, Attribute>) =>
      new CompositeAttribute("list", "computed", fields),
  },
};

export const schema = (fields: Record<string, Attribute>) =>
  new SchemaInternal(fields);

export const withDescription =
  (description: string) =>
  <T extends Attribute | Schema>(attributeOrSchema: T) => ({
    ...attributeOrSchema,
    description,
  });
