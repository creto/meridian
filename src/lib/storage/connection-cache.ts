import type { StorageConnection } from "./types.ts";

let current: StorageConnection[] = [];

export function rememberConnections(connections: StorageConnection[]) {
  current = connections;
}

export function lookupConnection(id: string): StorageConnection | undefined {
  return current.find((item) => item.id === id);
}
