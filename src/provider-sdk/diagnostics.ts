import { Effect, pipe } from "effect";
import {
  AttributePath_Step,
  Diagnostic_Severity,
  type Diagnostic,
} from "../gen/tfplugin6/tfplugin6.7_pb.js";
import type { PartialMessage } from "@bufbuild/protobuf";

export const diagnosticsPath = {
  attribute: (name: string) =>
    ({ case: "attributeName", value: name }) as const,
  elementKey: (name: string) =>
    ({ case: "elementKeyString", value: name }) as const,
  elementIndex: (index: number | bigint) =>
    ({
      case: "elementKeyInt",
      value: BigInt(index),
    }) as const,
};

export class DiagnosticError {
  readonly _tag = "DiagnosticError";

  constructor(readonly diagnostic: PartialMessage<Diagnostic>) {}
}

export class Diagnostics extends Effect.Tag("Diagnostics")<
  Diagnostics,
  {
    diagnostics: PartialMessage<Diagnostic>[];
    add(diagnostic: PartialMessage<Diagnostic>): void;
    warn(
      steps: Array<AttributePath_Step["selector"]>,
      summary: string,
      detail?: string,
    ): void;
    error(
      steps: Array<AttributePath_Step["selector"]>,
      summary: string,
      detail?: string,
    ): void;
    crit(
      steps: Array<AttributePath_Step["selector"]>,
      summary: string,
      detail?: string,
    ): Effect.Effect<never, DiagnosticError, never>;
  }
>() {}

const provideDiagnostics = () =>
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
      this.diagnostics.push({
        severity: Diagnostic_Severity.ERROR,
        summary,
        detail: detail ?? "",
        attribute: {
          steps: steps.map((step) => ({ selector: step })),
        },
      });
    },
    crit(steps, summary, detail) {
      return Effect.fail(
        new DiagnosticError({
          severity: Diagnostic_Severity.ERROR,
          summary,
          detail: detail ?? "",
          attribute: {
            steps: steps.map((step) => ({ selector: step })),
          },
        }),
      );
    },
  });

export const withDiagnostics =
  () =>
  <A extends {} | void, E extends { _tag: string }, R>(
    effect: Effect.Effect<A, E | DiagnosticError, R>,
  ): Effect.Effect<
    (A | {}) & { diagnostics: PartialMessage<Diagnostic>[] },
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
