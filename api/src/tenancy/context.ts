import { AsyncLocalStorage } from 'node:async_hooks';

// One store for the whole process. Each runWithTenant() call gets its OWN value inside it,
// even when many requests are in flight at the same time (a plain global variable would be shared).
const storage = new AsyncLocalStorage<{ tenantId: string }>();

// Runs fn with tenantId available to everything fn calls, including after any await.
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

// Returns the current tenant, or throws: a missing tenant must fail loudly, never fall back to "all".
export function getTenantId(): string {
  const store = storage.getStore();
  if (!store) throw new Error('No tenant in context');
  return store.tenantId;
}
