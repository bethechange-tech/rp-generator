/** Generic parallel execution interface (infrastructure agnostic) */
export interface IParallelScanner<T> {
  /** Execute tasks in parallel batches */
  scan<R>(
    items: T[],
    handler: (item: T) => Promise<R>,
    batchSize?: number
  ): Promise<R[]>;
}
