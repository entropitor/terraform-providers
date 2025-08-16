/**
 * Forces typescript to compute the type for hover
 * https://stackoverflow.com/questions/53993725/typescript-how-to-merge-the-representation-in-tooltip-of-this-intersection/53994079#53994079
 */
export type ForceTypescriptComputation<T> = { [P in keyof T]: T[P] } & {};
