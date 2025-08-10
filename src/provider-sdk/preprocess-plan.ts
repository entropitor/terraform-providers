import { unreachable } from "../utils/unreachable.js";
import type { Attribute, Schema, StateFor } from "./attributes.js";
import { Unknown } from "./codec.js";

const preprocessObject = (
  prior: any,
  proposed: any,
  fields: Record<string, Attribute>,
) => {
  if (proposed == null || proposed instanceof Unknown) {
    return proposed;
  }
  return Object.fromEntries(
    Object.entries(fields).map(([fieldName, field]) => {
      return [
        fieldName,
        preprocessAttribute(prior?.[fieldName], proposed?.[fieldName], field),
      ];
    }),
  );
};
const preprocessAttribute = (
  prior: any,
  proposed: any,
  attribute: Attribute,
): unknown => {
  if (attribute.presence === "computed" && proposed == null) {
    return prior ?? new Unknown();
  }

  switch (attribute.type) {
    case "string":
    case "number":
      return proposed;
    case "object":
      return preprocessObject(prior, proposed, attribute.fields);
    case "list":
      return proposed.map((proposedItem: any, index: number) =>
        preprocessObject(prior?.[index], proposedItem, attribute.fields),
      );
    default:
      return unreachable(attribute);
  }
};
export const preprocessPlan = <TResourceSchema extends Schema>(
  schema: TResourceSchema,
  priorState: StateFor<TResourceSchema> | null,
  proposedNewState: StateFor<TResourceSchema> | null,
): StateFor<TResourceSchema> => {
  return preprocessObject(priorState, proposedNewState, schema.attributes);
};
