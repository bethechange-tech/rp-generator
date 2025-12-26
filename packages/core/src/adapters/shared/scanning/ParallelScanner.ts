import { chunk } from "lodash";
import { IParallelScanner } from "../../../ports";

/** Generic parallel task executor with configurable concurrency */
export class ParallelScanner<T> implements IParallelScanner<T> {
  private readonly concurrency: number;

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
  }

  /** Execute tasks in parallel batches */
  async scan<R>(
    items: T[],
    handler: (item: T) => Promise<R>,
    batchSize?: number
  ): Promise<R[]> {
    const effectiveBatchSize = batchSize ?? this.concurrency;
    const batches = chunk(items, effectiveBatchSize);
    const results: R[] = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(handler));
      results.push(...batchResults);
    }

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
