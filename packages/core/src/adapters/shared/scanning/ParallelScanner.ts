import { PromisePool } from "@supercharge/promise-pool";
import { IParallelScanner } from "../../../ports";

/** Generic parallel task executor with configurable concurrency */
export class ParallelScanner<T> implements IParallelScanner<T> {
  private readonly concurrency: number;

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
  }

  /** Execute tasks in parallel with concurrency limit */
  async scan<R>(
    items: T[],
    handler: (item: T) => Promise<R>,
    batchSize?: number
  ): Promise<R[]> {
    const { results, errors } = await PromisePool
      .for(items)
      .withConcurrency(batchSize ?? this.concurrency)
      .process(handler);
    if (errors.length > 0) throw errors[0];
    return results;
  }

  /** Execute tasks in parallel and flatten array results */
  async scanAndFlatten<R>(
    items: T[],
    handler: (item: T) => Promise<R[]>,
    batchSize?: number
  ): Promise<R[]> {
    const results = await this.scan(items, handler, batchSize);
    return results.flat();
  }
}
