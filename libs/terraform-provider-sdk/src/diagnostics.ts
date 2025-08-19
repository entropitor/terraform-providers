/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { MessageInitShape } from "@bufbuild/protobuf";
import { Effect, pipe } from "effect";

import {
  type AttributePath_Step,
  Diagnostic_Severity,
  type DiagnosticSchema,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";

export type DiagnosticPath = Array<AttributePath_Step["selector"]>;
export const diagnosticsPath = {
  attribute: (name: string) =>
    ({ case: "attributeName", value: name }) as const,
  elementKey: (name: string) =>
    ({ case: "elementKeyString", value: name }) as const,
  elementIndex: (index: bigint | number) =>
    ({
      case: "elementKeyInt",
      value: BigInt(index),
    }) as const,
};

export const pathFromDiagnostic = (
  diagnostic: DiagnosticMessage,
): DiagnosticPath | undefined =>
  diagnostic.attribute?.steps?.map((step) => step.selector!);

export type DiagnosticMessage = MessageInitShape<typeof DiagnosticSchema>;

export const errorDiagnostic = (
  path: DiagnosticPath,
  summary: string,
  detail?: string,
): DiagnosticMessage => ({
  severity: Diagnostic_Severity.ERROR,
  summary,
  detail: detail ?? "",
  attribute: {
    steps: path.map((step) => ({ selector: step })),
  },
});

export class DiagnosticError {
  readonly _tag = "DiagnosticError";

  constructor(readonly diagnostic: DiagnosticMessage) {}

  static from(steps: DiagnosticPath, summary: string, detail?: string) {
    return new DiagnosticError(errorDiagnostic(steps, summary, detail));
  }
}

export class Diagnostics extends Effect.Tag("Diagnostics")<
  Diagnostics,
  {
    diagnostics: DiagnosticMessage[];
    add(diagnostic: DiagnosticMessage): void;
    warn(steps: DiagnosticPath, summary: string, detail?: string): void;
    error(steps: DiagnosticPath, summary: string, detail?: string): void;
    crit(
      steps: DiagnosticPath,
      summary: string,
      detail?: string,
    ): Effect.Effect<never, DiagnosticError>;
  }
>() {}

export const provideDiagnostics = () =>
  Effect.provideService(Diagnostics, {
    diagnostics: [],
    add(diagnostic) {
      this.diagnostics.push(diagnostic);
    },
    warn(steps, summary, detail) {
      this.diagnostics.push({
        severity: Diagnostic_Severity.WARNING,
        summary,
        detail: detail ?? "",
        attribute: {
          steps: steps.map((step) => ({ selector: step })),
        },
      });
    },
    error(steps, summary, detail) {
      this.diagnostics.push(errorDiagnostic(steps, summary, detail));
    },
    crit(steps, summary, detail) {
      return Effect.fail(DiagnosticError.from(steps, summary, detail));
    },
  });

export const withDiagnostics =
  () =>
  <A extends void | {}, E extends { _tag: string }, R>(
    effect: Effect.Effect<A, DiagnosticError | E, R>,
  ): Effect.Effect<
    (A | {}) & { diagnostics: DiagnosticMessage[] },
    E,
    Exclude<R, Diagnostics>
  > =>
    pipe(
      Effect.Do,
      Effect.bind("result", () =>
        effect.pipe(
          Effect.catchTag("DiagnosticError", (error) =>
            Effect.gen(function* () {
              // @ts-expect-error: We don't know if there is another error with the same tag or not
              yield* Diagnostics.add(error.diagnostic);
              return {};
            }),
          ),
        ),
      ),
      Effect.bind("diagnostics", () => Diagnostics.diagnostics),
      Effect.map(({ result, diagnostics }) => ({ ...result, diagnostics })),
      provideDiagnostics(),
    );
