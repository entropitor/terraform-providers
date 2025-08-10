import { Data, Effect } from "effect";
import type { LazyArg } from "effect/Function";
import type { FetchResponse } from "openapi-fetch";

export class RequestError<
  T extends FetchResponse<any, any, any> & { data?: never },
> extends Data.TaggedError("RequestError") {
  constructor(readonly fetchResponse: T) {
    super();
  }

  get error() {
    return this.fetchResponse.error;
  }
  get response() {
    return this.fetchResponse.response;
  }
}

export const effectify = <
  T extends Record<string | number, any>,
  Options,
  Media extends `${string}/${string}`,
>(
  lazy: LazyArg<Promise<FetchResponse<T, Options, Media>>>,
): Effect.Effect<
  Exclude<FetchResponse<T, Options, Media>, { data?: never }>["data"],
  RequestError<Exclude<FetchResponse<T, Options, Media>, { error?: never }>>,
  never
> => {
  // @ts-expect-error typescript isn't strong enough to see this is correct
  return Effect.promise(() => lazy()).pipe(
    Effect.flatMap((response) => {
      if (response.data != null) {
        return Effect.succeed(response.data);
      } else {
        return new RequestError(response);
      }
    }),
  );
};
