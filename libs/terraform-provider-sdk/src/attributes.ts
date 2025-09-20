/* eslint-disable @typescript-eslint/no-empty-object-type */
import assert from "assert";

import type { MessageInitShape } from "@bufbuild/protobuf";
import { type Pipeable, pipeArguments } from "effect/Pipeable";

import {
  type Schema_Attribute,
  type Schema_AttributeSchema,
  Schema_Object_NestingMode,
  type SchemaSchema,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";
import type { ForceTypescriptComputation } from "./utils/ForceTypescriptComputation.js";
import { unreachable } from "./utils/unreachable.js";

type SchemaMessage = MessageInitShape<typeof SchemaSchema>;
type SchemaAttributeMessage = MessageInitShape<typeof Schema_AttributeSchema>;

type AttributeType =
  | { type: "any" }
  | { type: "array"; itemType: IAttributeType<any> }
  | { type: "boolean" }
  | { type: "custom"; custom: IAttributeType<any> }
  | { type: "list"; fields: Record<string, Attribute> }
  | { type: "number" }
  | { type: "object"; fields: Record<string, Attribute> }
  | { type: "string" };

type Presence =
  | "computed"
  | "computed_if_not_given"
  | "optional"
  | "required"
  | "required_to_be_computed";

export type Attribute<
  TAttributeType extends AttributeType = AttributeType,
  TPresence extends Presence = Presence,
> = TAttributeType & {
  description?: string;
  requiresReplacementOnChange?: boolean;
} & { presence: TPresence };

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
    // eslint-disable-next-line prefer-rest-params
    return pipeArguments(this, arguments);
  }
}

class CustomAttribute<
  TType extends IAttributeType<any>,
  TPresence extends Presence,
> extends BaseAttribute {
  readonly type = "custom";

  constructor(
    public readonly custom: TType,
    public readonly presence: TPresence,
  ) {
    super();
  }
}

class PrimitiveAttribute<
  TType extends "any" | "boolean" | "number" | "string",
  TPresence extends Presence,
> extends BaseAttribute {
  constructor(
    public readonly type: TType,
    public readonly presence: TPresence,
  ) {
    super();
  }
}

class ArrayAttribute<
  TItemType extends IAttributeType<any>,
  TPresence extends Presence,
> extends BaseAttribute {
  readonly type = "array";

  constructor(
    public readonly itemType: TItemType,
    public readonly presence: TPresence,
  ) {
    super();
  }
}

export type AttributeFields = Record<string, Attribute>;
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
  TAlternatives extends AttributeFields[] = AttributeFields[],
> extends BaseAttribute {
  constructor(
    public readonly alternatives: TAlternatives,
    public readonly presence: "union" = "union",
  ) {
    super();
  }

  fieldNamesIfAllAlternativesAreSingleRequiredFields(): null | string[] {
    const names = this.alternatives.map((alternative) => {
      const keys = Object.keys(alternative);
      return (
          keys.length === 1 && alternative[keys[0]!]!.presence === "required"
        ) ?
          keys[0]!
        : null;
    });
    const filteredNames = names.filter((name) => name != null);
    return filteredNames.length === names.length ? filteredNames : null;
  }
}

const presenceFrom = (
  attr: Attribute,
  insideUnion: boolean,
): Pick<Schema_Attribute, "computed" | "optional" | "required"> => {
  switch (attr.presence) {
    case "computed":
    case "required_to_be_computed":
      return { required: false, optional: false, computed: true };
    case "computed_if_not_given":
      return { required: false, optional: true, computed: true };
    case "optional":
      return { required: false, optional: true, computed: false };
    case "required":
      if (insideUnion) {
        return { required: false, optional: true, computed: false };
      }
      return { required: true, optional: false, computed: false };
    default:
      return unreachable(attr.presence);
  }
};

const typeFrom = (
  attr: AttributeType,
): Pick<SchemaAttributeMessage, "nestedType" | "type"> => {
  switch (attr.type) {
    case "any":
      return { type: Buffer.from('"dynamic"') };
    case "array": {
      const itemType = typeFrom(attr.itemType.originialType);
      assert(itemType.type != null, "array item type must be a primitive");
      return { type: Buffer.from(`["list",${itemType.type.toString()}]`) };
    }
    case "boolean":
      return { type: Buffer.from('"bool"') };
    case "custom":
      return typeFrom(attr.custom.originialType);
    case "list":
      return {
        nestedType: {
          nesting: Schema_Object_NestingMode.LIST,
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          attributes: attributeListFrom(attr.fields),
        },
      };
    case "number":
      return { type: Buffer.from('"number"') };
    case "object":
      return {
        nestedType: {
          nesting: Schema_Object_NestingMode.SINGLE,
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          attributes: attributeListFrom(attr.fields),
        },
      };
    case "string":
      return { type: Buffer.from('"string"') };
    default:
      return unreachable(attr);
  }
};

export const attributeListFrom = (
  fields: Fields,
  insideUnion: boolean = false,
): SchemaAttributeMessage[] => {
  return Object.entries(fields).flatMap(
    ([name, attr]): SchemaAttributeMessage[] => {
      if (attr instanceof UnionAttribute) {
        return attr.alternatives.flatMap((alternative: Fields) =>
          attributeListFrom(alternative, true),
        );
      }
      return [
        {
          name,
          ...(attr.description != null ?
            { description: attr.description }
          : {}),
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
export const toTerraformSchema = (schema: Schema): SchemaMessage => {
  return {
    block: {
      attributes: attributeListFrom(schema.attributes),
      ...(schema.description != null ?
        { description: schema.description }
      : {}),
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
    // eslint-disable-next-line prefer-rest-params
    return pipeArguments(this, arguments);
  }

  toTerraformSchema() {
    return toTerraformSchema(this);
  }
}

export type IAttributeType<T> = {
  _T: T;
  readonly originialType: AttributeType;
};

class StringAttributeType implements IAttributeType<string> {
  readonly _T!: string;
  readonly originialType = { type: "string" } as const;
}
class TransformAttributeType<TFrom, TResult>
  implements IAttributeType<TResult>
{
  readonly _T!: TResult;
  get originialType() {
    return this.originalAttributeType.originialType;
  }

  constructor(
    public readonly originalAttributeType: IAttributeType<TFrom>,
    public readonly fn: (value: TFrom) => TResult,
  ) {}
}

export const attributeType = {
  string: new StringAttributeType(),
};

export const transform = <TFrom, TResult>(
  originalType: IAttributeType<TFrom>,
  fn: (value: TFrom) => TResult,
): IAttributeType<TResult> => {
  return new TransformAttributeType(originalType, fn);
};

export const tf = {
  optional: {
    boolean: () => new PrimitiveAttribute("boolean", "optional"),
    array: <T>(itemType: IAttributeType<T>) =>
      new ArrayAttribute(itemType, "optional"),
    custom: <T>(customType: IAttributeType<T>) =>
      new CustomAttribute(customType, "optional"),
    string: () => new PrimitiveAttribute("string", "optional"),
    number: () => new PrimitiveAttribute("number", "optional"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "optional", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "optional", fields),
  },
  required: {
    any: () => new PrimitiveAttribute("any", "required"),
    boolean: () => new PrimitiveAttribute("boolean", "required"),
    custom: <T>(customType: IAttributeType<T>) =>
      new CustomAttribute(customType, "required"),
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
  computedIfNotGiven: {
    boolean: () => new PrimitiveAttribute("boolean", "computed_if_not_given"),
    custom: <T>(customType: IAttributeType<T>) =>
      new CustomAttribute(customType, "computed_if_not_given"),
    string: () => new PrimitiveAttribute("string", "computed_if_not_given"),
    number: () => new PrimitiveAttribute("number", "computed_if_not_given"),
    object: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("object", "computed_if_not_given", fields),
    list: <TFields extends Fields>(fields: TFields) =>
      new CompositeAttribute("list", "computed_if_not_given", fields),
  },
  // TODO: rename to computed and make computed nullableComputed instead
  // or move it into computed.nullable and computed.nonNullable
  // and maybe do the same for computedIfNotGiven
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

type ConfigForAttribute<TAttribute extends AttributeType> =
  ForceTypescriptComputation<
    TAttribute extends { type: "custom" } ? TAttribute["custom"]["_T"]
    : TAttribute extends { type: "string" } ? string
    : TAttribute extends { type: "number" } ? number
    : TAttribute extends { type: "boolean" } ? boolean
    : TAttribute extends { type: "any" } ? unknown
    : TAttribute extends { type: "array" } ? Array<TAttribute["itemType"]["_T"]>
    : TAttribute extends { type: "object" } ?
      {
        [TField in keyof TAttribute["fields"] as TAttribute["fields"][TField]["presence"] extends (
          "computed" | "required_to_be_computed"
        ) ?
          never
        : TField]: ConfigForAttribute<TAttribute["fields"][TField]>;
      }
    : TAttribute extends { type: "list" } ?
      Array<{
        [TField in keyof TAttribute["fields"] as TAttribute["fields"][TField]["presence"] extends (
          "computed" | "required_to_be_computed"
        ) ?
          never
        : TField]: ConfigForAttribute<TAttribute["fields"][TField]>;
      }>
    : never
  >;

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I
  : never;

type UnionAttributeFields<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"]]: TSchema["attributes"][TField] extends (
    UnionAttribute<any>
  ) ?
    TField
  : never;
}[keyof TSchema["attributes"]];
type Element<T> = T extends any[] ? T[number] : never;

export type ConfigForNormalAttributes<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"] as TSchema["attributes"][TField]["presence"] extends (
    "computed" | "union"
  ) ?
    never
  : TField]: TSchema["attributes"][TField] extends (
    infer TAttribute extends Attribute
  ) ?
    TAttribute["presence"] extends "computed_if_not_given" | "optional" ?
      ConfigForAttribute<TAttribute> | null
    : ConfigForAttribute<TAttribute>
  : never;
};
type ConfigForUnionAttributes<TSchema extends Schema> =
  UnionAttributeFields<TSchema> extends never ? {}
  : Element<
      UnionToIntersection<
        {
          [TField in UnionAttributeFields<TSchema>]: TSchema["attributes"][TField] extends (
            UnionAttribute<Array<infer TAlternative extends AttributeFields>>
          ) ?
            [
              TAlternative extends Fields ?
                ConfigForNormalAttributes<{
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

type OptionalPresenceInState = "computed" | "optional";
type StateForOptionalAttributes<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"] as TSchema["attributes"][TField]["presence"] extends (
    OptionalPresenceInState
  ) ?
    TField
  : never]+?: TSchema["attributes"][TField] extends (
    infer TAttribute extends Attribute
  ) ?
    ConfigForAttribute<TAttribute> | undefined
  : never;
};

type StateForRequiredAttribute<TSchema extends Schema> = {
  [TField in keyof TSchema["attributes"] as TSchema["attributes"][TField]["presence"] extends (
    "union" | OptionalPresenceInState
  ) ?
    never
  : TField]: TSchema["attributes"][TField] extends (
    infer TAttribute extends Attribute
  ) ?
    ConfigForAttribute<TAttribute>
  : never;
};

type StateForUnionAttributes<TSchema extends Schema> =
  UnionAttributeFields<TSchema> extends never ? {}
  : Element<
      UnionToIntersection<
        {
          [TField in UnionAttributeFields<TSchema>]: TSchema["attributes"][TField] extends (
            UnionAttribute<Array<infer TAlternative extends AttributeFields>>
          ) ?
            [
              TAlternative extends Fields ?
                StateForNormalAttributes<{
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
