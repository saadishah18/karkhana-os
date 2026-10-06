// TODO (Saad): hold the current request's tenantId using AsyncLocalStorage.
//   runWithTenant(tenantId, fn): runs fn with tenantId available to everything it calls
//   getTenantId(): returns it, or throws if there is no tenant in context
// Hint: node:async_hooks. Think of it as a "thread-local" for async code.

export function runWithTenant<T>(_tenantId: string, _fn: () => T): T {
  throw new Error('not implemented');
}

export function getTenantId(): string {
  throw new Error('not implemented');
}
