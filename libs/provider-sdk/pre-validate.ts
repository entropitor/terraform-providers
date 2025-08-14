import {
  UnionAttribute,
  type Attribute,
  type Fields,
  type Schema,
} from "./attributes.js";
import { unreachable } from "../utils/unreachable.js";
import { Unknown } from "./codec.js";
import { Effect } from "effect";
import {
  Diagnostics,
  diagnosticsPath,
  pathFromDiagnostic,
  provideDiagnostics,
  type DiagnosticError,
  type DiagnosticMessage,
  type DiagnosticPath,
} from "./diagnostics.js";

const preValidateUnion = (
  value: unknown,
  field: UnionAttribute,
  fieldName: string,
  path: DiagnosticPath,
): Effect.Effect<undefined, DiagnosticError, Diagnostics> => {
  return Effect.gen(function* () {
    const validateAlternativeEffects: Effect.Effect<
      { isValid: boolean; diagnostics: DiagnosticMessage[] },
      never,
      never
    >[] = field.alternatives.map((alternative) =>
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
              "Failed to validate: " +
                diagnostic.summary +
                "\n\n" +
                diagnostic.detail,
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
    )) satisfies (void | undefined)[];
    return undefined;
  });

const preValidateAttribute = (
  value: unknown,
  attribute: Attribute,
  attributeName: string,
  path: DiagnosticPath,
): Effect.Effect<void | undefined, DiagnosticError, Diagnostics> =>
  Effect.gen(function* () {
    if (value instanceof Unknown) {
      return;
    }
    if (value == null) {
      switch (attribute.presence) {
        case "computed":
        case "required_to_be_computed":
        case "optional_or_computed":
        case "optional":
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
      case "string":
      case "number":
      case "boolean":
        if (typeof value !== attribute.type) {
          return yield* Diagnostics.error(path, "Attribute has the wrong type");
        }
        return;

      case "object":
        return yield* preValidateObject(value, attribute.fields, path);

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
      default:
        return unreachable(attribute);
    }
  });

export const preValidateSchema = (
  value: unknown,
  schema: Schema,
): Effect.Effect<void | undefined, DiagnosticError, Diagnostics> => {
  return preValidateObject(value, schema.attributes, []);
};
