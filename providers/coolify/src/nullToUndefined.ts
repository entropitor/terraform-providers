export const nullToUndefined = <T extends Record<string, any>>(
  x: T,
): {
  [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | undefined : T[K];
} => {
  //  TODO: Implement?
  return x;
};
