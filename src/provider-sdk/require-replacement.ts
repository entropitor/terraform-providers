import { Effect, pipe } from "effect";
import {
  AttributePath as TerraformAttributePath,
  AttributePath_Step,
} from "./gen/tfplugin6/tfplugin6.7_pb.js";
import type { PartialMessage } from "@bufbuild/protobuf";

export type AttributePath = Array<AttributePath_Step["selector"]>;
export const attributePath = {
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

export type RequiresReplacement = PartialMessage<TerraformAttributePath>;

export class RequiresReplacementTracker extends Effect.Tag(
  "RequiresReplacementTracker",
)<
  RequiresReplacementTracker,
  {
    requiresReplacements: RequiresReplacement[];
    add(path: AttributePath): void;
  }
>() {}

export const provideRequiresReplacement = () =>
  Effect.provideService(RequiresReplacementTracker, {
    requiresReplacements: [],
    add(path) {
      this.requiresReplacements.push({
        steps: path.map((step) => ({ selector: step })),
      });
    },
  });

export const withTrackedReplacements =
  () =>
  <A extends {} | void, E extends { _tag: string }, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<
    readonly [A, RequiresReplacement[]],
    E,
    Exclude<R, RequiresReplacementTracker>
  > =>
    pipe(
      Effect.Do,
      Effect.bind("result", () => effect),
      Effect.bind(
        "replacements",
        () => RequiresReplacementTracker.requiresReplacements,
      ),
      Effect.map(({ result, replacements }) => [result, replacements] as const),
      provideRequiresReplacement(),
    );
