import { Effect } from "effect";

import {
  type Attribute,
  type Fields,
  type Schema,
  type StateFor,
  UnionAttribute,
} from "./attributes.js";
import { Unknown } from "./codec.js";
import type { DiagnosticError, Diagnostics } from "./diagnostics.js";
import {
  attributePath,
  type AttributePath,
  RequiresReplacementTracker,
} from "./require-replacement.js";
import { unreachable } from "./utils/unreachable.js";

// Delete does not call plan
type PlanOperation = "create" | "update";

type PreProcessResult<T = any> = Effect.Effect<
  T,
  DiagnosticError,
  Diagnostics | RequiresReplacementTracker
>;

const preprocessObject = (
  prior: any,
  proposed: any,
  fields: Fields,
  path: AttributePath,
  operation: PlanOperation,
): PreProcessResult =>
  Effect.gen(function* () {
    if (proposed == null || proposed instanceof Unknown) {
      return proposed;
    }

    const newEntries = yield* Effect.all(
      Object.entries(fields).map(([fieldName, field]) =>
        Effect.gen(function* () {
          if (field instanceof UnionAttribute) {
            const effects = (
              field.alternatives as UnionAttribute["alternatives"]
            ).map((alternative: UnionAttribute["alternatives"][number]) =>
              preprocessObject(
                prior,
                proposed,
                alternative,
                path,
                operation,
              ).pipe(Effect.map((x) => Object.entries(x))),
            );
            return (yield* Effect.all(effects)).flat();
          }

          const attributeResult = yield* preprocessAttribute(
            prior?.[fieldName],
            proposed?.[fieldName],
            field,
            [...path, attributePath.attribute(fieldName)],
            operation,
          );
          return [[fieldName, attributeResult]] as const;
        }),
      ),
    );

    return Object.fromEntries(newEntries.flat());
  });

const preprocessAttribute = (
  prior: any,
  proposed: any,
  attribute: Attribute,
  path: AttributePath,
  operation: PlanOperation,
): PreProcessResult =>
  Effect.gen(function* () {
    if (attribute.requiresReplacementOnChange && operation == "update") {
      yield* RequiresReplacementTracker.add(path);
    }

    if (attribute.presence === "computed" && proposed == null) {
      return prior ?? new Unknown();
    }

    switch (attribute.type) {
      case "boolean":
      case "number":
      case "string":
        return proposed;
      case "list":
        const effects = (proposed as any[]).map(
          (proposedItem: any, index: number) =>
            preprocessObject(
              prior?.[index],
              proposedItem,
              attribute.fields,
              [...path, attributePath.elementIndex(index)],
              operation,
            ),
        );
        return yield* Effect.all(effects);
      case "object":
        return yield* preprocessObject(
          prior,
          proposed,
          attribute.fields,
          path,
          operation,
        );
      default:
        return unreachable(attribute);
    }
  });

export const preprocessPlan = <TResourceSchema extends Schema>(
  schema: TResourceSchema,
  priorState: null | StateFor<TResourceSchema>,
  proposedNewState: null | StateFor<TResourceSchema>,
): PreProcessResult<StateFor<TResourceSchema>> => {
  const operation = priorState == null ? "create" : "update";
  return preprocessObject(
    priorState,
    proposedNewState,
    schema.attributes,
    [],
    operation,
  );
};
