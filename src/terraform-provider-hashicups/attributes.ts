import { unreachable } from "./unreachable.js";
import {
  Schema as TerraformSchema,
  Schema_Attribute,
  Schema_Object_NestingMode,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import { pipeArguments, type Pipeable } from "effect/Pipeable";
import type { PartialMessage } from "@bufbuild/protobuf";
import type { ForceTypescriptComputation } from "./ForceTypescriptComputation.js";

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

class PrimitiveAttribute<
  TType extends "string" | "number",
  TPresence extends Presence,
> extends BaseAttribute {
  constructor(
    public readonly type: TType,
    public readonly presence: TPresence,
  ) {
    super();
  }
}

type Fields = Record<string, Attribute>;

class CompositeAttribute<
  TType extends "list" | "object",
  TPresence extends Presence,
  TFields extends Fields,
> extends BaseAttribute {
  constructor(
    public readonly type: TType,
    public readonly presence: TPresence,
    public readonly fields: TFields,
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
  fields: Fields,
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

export type Schema<TFields extends Fields = Fields> = {
  attributes: TFields;
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

class SchemaInternal<TFields extends Fields> implements Pipeable {
  constructor(public readonly attributes: TFields) {}

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
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "optional", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "optional", fields),
  },
  required: {
    string: () => new PrimitiveAttribute("string", "required"),
    number: () => new PrimitiveAttribute("number", "required"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "required", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "required", fields),
  },
  computed: {
    string: () => new PrimitiveAttribute("string", "computed"),
    number: () => new PrimitiveAttribute("number", "computed"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "computed", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "computed", fields),
  },
};

export const schema = <TFields extends Record<string, Attribute>>(
  fields: TFields,
) => new SchemaInternal(fields);

export const withDescription =
  (description: string) =>
  <T extends Attribute | Schema>(attributeOrSchema: T) => ({
    ...attributeOrSchema,
    description,
  });

type ConfigForAttribute<TAttribute extends Attribute> =
  ForceTypescriptComputation<
    TAttribute extends { type: "string" }
      ? string
      : TAttribute extends { type: "number" }
        ? number
        : TAttribute extends { type: "object" }
          ? {
              [TField in keyof TAttribute["fields"] as TAttribute["fields"][TField]["presence"] extends "computed"
                ? never
                : TField]: ConfigForAttribute<TAttribute["fields"][TField]>;
            }
          : TAttribute extends { type: "list" }
            ? Array<{
                [TField in keyof TAttribute["fields"] as TAttribute["fields"][TField]["presence"] extends "computed"
                  ? never
                  : TField]: ConfigForAttribute<TAttribute["fields"][TField]>;
              }>
            : never
  >;

export type ConfigFor<TSchema extends Schema> = ForceTypescriptComputation<{
  [TField in keyof TSchema["attributes"] as TSchema["attributes"][TField]["presence"] extends "computed"
    ? never
    : TField]: ConfigForAttribute<TSchema["attributes"][TField]>;
}>;

export type StateFor<TSchema extends Schema> = ForceTypescriptComputation<{
  [TField in keyof TSchema["attributes"]]: ConfigForAttribute<
    TSchema["attributes"][TField]
  >;
}>;
