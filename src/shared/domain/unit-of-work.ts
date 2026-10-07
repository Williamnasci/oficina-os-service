export type TransactionContext = unknown;

export abstract class UnitOfWork {
  abstract runInTransaction<T>(
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T>;
}
