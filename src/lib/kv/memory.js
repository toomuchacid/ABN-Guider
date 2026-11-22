/** Minimal KV stand-in for unit tests. Matches the methods we call. */
export function createMemoryKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const value = store.get(key);
      if (value == null) return null;
      if (type === 'json') return JSON.parse(value);
      return value;
    },
    async put(key, value) {
      store.set(key, value);
    },
    dump() {
      return store;
    },
  };
}
