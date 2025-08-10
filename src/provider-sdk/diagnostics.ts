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

export class Diagnostics extends Effect.Tag("Diagnostics")<
  Diagnostics,
  {
    diagnostics: PartialMessage<Diagnostic>[];
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
  }
>() {}

const provideDiagnostics = () =>
  Effect.provideService(Diagnostics, {
    diagnostics: [],
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
  });

export const withDiagnostics =
  () =>
  <A extends {} | void, E, R>(effect: Effect.Effect<A, E, R>) =>
    pipe(
      Effect.Do,
      Effect.bind("result", () => effect),
      Effect.bind("diagnostics", () => Diagnostics.diagnostics),
      Effect.map(({ result, diagnostics }) => ({ ...result, diagnostics })),
      provideDiagnostics(),
    );
