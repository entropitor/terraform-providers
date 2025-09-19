/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Effect } from "effect";

import {
  type Attribute,
  type Fields,
  type Schema,
  UnionAttribute,
} from "./attributes.js";
import { Unknown } from "./codec.js";
import {
  type DiagnosticError,
  type DiagnosticMessage,
  type DiagnosticPath,
  Diagnostics,
  diagnosticsPath,
  pathFromDiagnostic,
  provideDiagnostics,
} from "./diagnostics.js";
import { unreachable } from "./utils/unreachable.js";

const preValidateUnion = (
  value: unknown,
  field: UnionAttribute,
  fieldName: string,
  path: DiagnosticPath,
): Effect.Effect<undefined, DiagnosticError, Diagnostics> => {
  return Effect.gen(function* () {
    const validateAlternativeEffects: Array<
      Effect.Effect<{ isValid: boolean; diagnostics: DiagnosticMessage[] }>
    > = field.alternatives.map((alternative) =>
      preValidateObject(value, alternative, path).pipe(
        Effect.flatMap(() =>
          Diagnostics.diagnostics.pipe(
            Effect.map((diagnostics) => ({
              isValid: diagnostics.length === 0,
              diagnostics,
            })),
          ),
        ),
        Effect.catchTag("DiagnosticError", (error) =>
          Effect.succeed({
            isValid: false,
            diagnostics: [error.diagnostic],
          }),
        ),
        provideDiagnostics(),
      ),
    );
    const validAlternatives = yield* Effect.all(validateAlternativeEffects);

    if (validAlternatives.every((result) => !result.isValid)) {
      const allDiagnostics = validAlternatives.flatMap(
        (result) => result.diagnostics,
      );
      const requiredFieldNames =
        field.fieldNamesIfAllAlternativesAreSingleRequiredFields();
      if (requiredFieldNames != null) {
        yield* Diagnostics.error(
          path,
          `Union ${fieldName} requires one of the following fields: ${requiredFieldNames.join(", ")}`,
        );
      } else {
        yield* Effect.all(
          allDiagnostics.map((diagnostic) =>
            Diagnostics.error(
              pathFromDiagnostic(diagnostic) ?? path,
              `No valid alternative found for union '${fieldName}'`,
              `Failed to validate: ${diagnostic.summary}\n\n${
                diagnostic.detail
              }`,
            ),
          ),
        );
      }
    }
    return undefined;
  });
};

const preValidateObject = (
  value: unknown,
  fields: Fields,
  path: DiagnosticPath,
): Effect.Effect<undefined, DiagnosticError, Diagnostics> =>
  Effect.gen(function* () {
    if (value == null || value instanceof Unknown) {
      return;
    }

    (yield* Effect.all(
      Object.entries(fields).map(([fieldName, field]) =>
        Effect.gen(function* () {
          if (field instanceof UnionAttribute) {
            return yield* preValidateUnion(value, field, fieldName, path);
          }
          return yield* preValidateAttribute(
            (value as any)[fieldName],
            field,
            fieldName,
            [...path, diagnosticsPath.attribute(fieldName)],
          );
        }),
      ),
    )) satisfies Array<undefined | void>;
    return undefined;
  });

const preValidateAttribute = (
  value: unknown,
  attribute: Attribute,
  attributeName: string,
  path: DiagnosticPath,
): Effect.Effect<undefined | void, DiagnosticError, Diagnostics> =>
  Effect.gen(function* () {
    if (value instanceof Unknown) {
      return;
    }
    if (value == null) {
      switch (attribute.presence) {
        case "computed":
        case "computed_if_not_given":
        case "optional":
        case "required_to_be_computed":
          return;
        case "required":
          return yield* Diagnostics.error(
            path,
            `Required attribute '${attributeName}' is missing`,
          );
        default:
          return unreachable(attribute.presence);
      }
    }

    switch (attribute.type) {
      case "any":
        return;

      case "boolean":
      case "number":
      case "string":
        if (typeof value !== attribute.type) {
          return yield* Diagnostics.error(path, "Attribute has the wrong type");
        }
        return;

      case "custom":
        // TODO: run custom validation function
        if (typeof value !== attribute.custom.originialType.type) {
          return yield* Diagnostics.error(path, "Attribute has the wrong type");
        }
        return;

      case "list":
        if (!Array.isArray(value)) {
          return yield* Diagnostics.error(path, "Attribute has the wrong type");
        }
        yield* Effect.all(
          value.map((item: any, index) =>
            preValidateObject(item, attribute.fields, [
              ...path,
              diagnosticsPath.elementIndex(index),
            ]),
          ),
        );
        return;

      case "object":
        return yield* preValidateObject(value, attribute.fields, path);
      default:
        return unreachable(attribute);
    }
  });

export const preValidateSchema = (
  value: unknown,
  schema: Schema,
): Effect.Effect<undefined | void, DiagnosticError, Diagnostics> => {
  return preValidateObject(value, schema.attributes, []);
};
