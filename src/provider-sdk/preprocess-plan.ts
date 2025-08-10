import { unreachable } from "../utils/unreachable.js";
import {
  UnionAttribute,
  type Attribute,
  type Fields,
  type Schema,
  type StateFor,
} from "./attributes.js";
import { Unknown } from "./codec.js";

const preprocessObject = (prior: any, proposed: any, fields: Fields) => {
  if (proposed == null || proposed instanceof Unknown) {
    return proposed;
  }
  return Object.fromEntries(
    Object.entries(fields).flatMap(([fieldName, field]) => {
      if (field instanceof UnionAttribute) {
        return field.alternatives.flatMap(
          (alternative: UnionAttribute["alternatives"][number]) =>
            Object.entries(preprocessObject(prior, proposed, alternative)),
        );
      }
      return [
        [
          fieldName,
          preprocessAttribute(prior?.[fieldName], proposed?.[fieldName], field),
        ],
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
    case "boolean":
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
