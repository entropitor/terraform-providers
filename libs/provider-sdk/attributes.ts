import { unreachable } from "../utils/unreachable.js";
import {
  Schema as TerraformSchema,
  Schema_Attribute,
  Schema_Object_NestingMode,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";
import { pipeArguments, type Pipeable } from "effect/Pipeable";
import type { PartialMessage } from "@bufbuild/protobuf";
import type { ForceTypescriptComputation } from "../utils/ForceTypescriptComputation.js";

type AttributeType =
  | { type: "string" }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "list"; fields: Record<string, Attribute> }
  | { type: "object"; fields: Record<string, Attribute> };

type Presence =
  | "required"
  | "computed"
  | "optional"
  | "optional_or_computed"
  | "required_to_be_computed";

export type Attribute<
  TAttributeType extends AttributeType = AttributeType,
  TPresence extends Presence = Presence,
> = TAttributeType & { presence: TPresence } & {
  description?: string;
  requiresReplacementOnChange?: boolean;
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
  TType extends "string" | "number" | "boolean",
  TPresence extends Presence,
> extends BaseAttribute {
  constructor(
    public readonly type: TType,
    public readonly presence: TPresence,
  ) {
    super();
  }
}

type AttributeFields = Record<string, Attribute>;
export type Fields = Record<string, Attribute | UnionAttribute<any>>;

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

export class UnionAttribute<
  TAlternatives extends Array<AttributeFields> = AttributeFields[],
> extends BaseAttribute {
  constructor(
    public readonly alternatives: TAlternatives,
    public readonly presence: "union" = "union",
  ) {
    super();
  }

  fieldNamesIfAllAlternativesAreSingleRequiredFields(): string[] | null {
    const names = this.alternatives.map((alternative) => {
      const keys = Object.keys(alternative);
      return keys.length === 1 && alternative[keys[0]!]!.presence === "required"
        ? keys[0]!
        : null;
    });
    const filteredNames = names.filter((name) => name != null);
    return filteredNames.length == names.length ? filteredNames : null;
  }
}

const presenceFrom = (
  attr: Attribute,
  insideUnion: boolean,
): Pick<Schema_Attribute, "computed" | "required" | "optional"> => {
  switch (attr.presence) {
    case "required":
      if (insideUnion) {
        return { required: false, optional: true, computed: false };
      }
      return { required: true, optional: false, computed: false };
    case "computed":
    case "required_to_be_computed":
      return { required: false, optional: false, computed: true };
    case "optional":
      return { required: false, optional: true, computed: false };
    case "optional_or_computed":
      return { required: false, optional: true, computed: true };
    default:
      return unreachable(attr.presence);
  }
};

const typeFrom = (
  attr: Attribute,
): Pick<PartialMessage<Schema_Attribute>, "type" | "nestedType"> => {
  switch (attr.type) {
    case "boolean":
      return { type: Buffer.from('"bool"') };
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
  insideUnion: boolean = false,
): PartialMessage<Schema_Attribute>[] => {
  return Object.entries(fields).flatMap(
    ([name, attr]): PartialMessage<Schema_Attribute>[] => {
      if (attr instanceof UnionAttribute) {
        return attr.alternatives.flatMap((alternative: Fields) =>
          attributeListFrom(alternative, true),
        );
      }
      return [
        {
          name,
          ...(attr.description ? { description: attr.description } : {}),
          ...presenceFrom(attr, insideUnion),
          ...typeFrom(attr),
        },
      ];
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
    boolean: () => new PrimitiveAttribute("boolean", "optional"),
    string: () => new PrimitiveAttribute("string", "optional"),
    number: () => new PrimitiveAttribute("number", "optional"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "optional", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "optional", fields),
  },
  required: {
    boolean: () => new PrimitiveAttribute("boolean", "required"),
    string: () => new PrimitiveAttribute("string", "required"),
    number: () => new PrimitiveAttribute("number", "required"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "required", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "required", fields),
  },
  computed: {
    boolean: () => new PrimitiveAttribute("boolean", "computed"),
    string: () => new PrimitiveAttribute("string", "computed"),
    number: () => new PrimitiveAttribute("number", "computed"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "computed", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "computed", fields),
  },
  alwaysComputed: {
    boolean: () => new PrimitiveAttribute("boolean", "required_to_be_computed"),
    string: () => new PrimitiveAttribute("string", "required_to_be_computed"),
    number: () => new PrimitiveAttribute("number", "required_to_be_computed"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "required_to_be_computed", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "required_to_be_computed", fields),
  },
  union: <TAlternatives extends AttributeFields[]>(
    ...alternatives: TAlternatives
  ) => new UnionAttribute(alternatives),
};

export const schema = <TFields extends Fields>(fields: TFields) =>
  new SchemaInternal(fields);

export const withDescription =
  (description: string) =>
  <T extends Attribute | Schema>(attributeOrSchema: T) => ({
    ...attributeOrSchema,
    description,
  });

export const requiresReplacementOnChange =
  () =>
  <T extends Attribute | Schema>(attributeOrSchema: T) => ({
    ...attributeOrSchema,
    requiresReplacementOnChange: true,
  });

type ConfigForAttribute<TAttribute extends Attribute> =
  ForceTypescriptComputation<
    TAttribute extends { type: "string" }
      ? string
      : TAttribute extends { type: "number" }
        ? number
        : TAttribute extends { type: "boolean" }
          ? boolean
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

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type UnionAttributeFields<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"]]: TSchema["attributes"][TField] extends UnionAttribute<any>
    ? TField
    : never;
}[keyof TSchema["attributes"]];
type Element<T> = T extends Array<any> ? T[number] : never;

export type ConfigForNormalAttributes<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"] as TSchema["attributes"][TField]["presence"] extends
    | "computed"
    | "union"
    ? never
    : TField]: TSchema["attributes"][TField] extends infer TAttribute extends
    Attribute
    ? TAttribute["presence"] extends "optional"
      ? ConfigForAttribute<TAttribute> | undefined
      : ConfigForAttribute<TAttribute>
    : never;
};
type ConfigForUnionAttributes<TSchema extends Schema> =
  UnionAttributeFields<TSchema> extends never
    ? {}
    : Element<
        UnionToIntersection<
          {
            [TField in UnionAttributeFields<TSchema>]: TSchema["attributes"][TField] extends UnionAttribute<
              Array<infer TAlternative extends AttributeFields>
            >
              ? [
                  TAlternative extends Fields
                    ? ConfigForNormalAttributes<{
                        attributes: TAlternative;
                      }>
                    : never,
                ]
              : never;
          }[UnionAttributeFields<TSchema>]
        >
      >;

export type ConfigFor<TSchema extends Schema> = ForceTypescriptComputation<
  ConfigForNormalAttributes<TSchema> & ConfigForUnionAttributes<TSchema>
>;

type OptionalPresenceInState = "optional" | "optional_or_computed" | "computed";
type StateForOptionalAttributes<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"] as TSchema["attributes"][TField]["presence"] extends OptionalPresenceInState
    ? TField
    : never]+?: TSchema["attributes"][TField] extends infer TAttribute extends
    Attribute
    ? undefined | ConfigForAttribute<TAttribute>
    : never;
};

type StateForRequiredAttribute<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"] as TSchema["attributes"][TField]["presence"] extends
    | OptionalPresenceInState
    | "union"
    ? never
    : TField]: TSchema["attributes"][TField] extends infer TAttribute extends
    Attribute
    ? ConfigForAttribute<TAttribute>
    : never;
};

type StateForUnionAttributes<TSchema extends Schema> =
  UnionAttributeFields<TSchema> extends never
    ? {}
    : Element<
        UnionToIntersection<
          {
            [TField in UnionAttributeFields<TSchema>]: TSchema["attributes"][TField] extends UnionAttribute<
              Array<infer TAlternative extends AttributeFields>
            >
              ? [
                  TAlternative extends Fields
                    ? StateForNormalAttributes<{
                        attributes: TAlternative;
                      }>
                    : never,
                ]
              : never;
          }[UnionAttributeFields<TSchema>]
        >
      >;

type StateForNormalAttributes<TSchema extends Schema> =
  StateForOptionalAttributes<TSchema> & StateForRequiredAttribute<TSchema>;
export type StateFor<TSchema extends Schema> = ForceTypescriptComputation<
  StateForNormalAttributes<TSchema> & StateForUnionAttributes<TSchema>
>;
