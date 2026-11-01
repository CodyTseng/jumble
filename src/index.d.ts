interface Array<T> {
  findLast(predicate: (value: T, index: number, obj: T[]) => boolean, thisArg?: any): T | undefined
}
