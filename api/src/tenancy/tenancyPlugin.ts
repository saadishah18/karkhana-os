import type { Schema } from 'mongoose';

// TODO (Saad): a Mongoose plugin so every query on a tenant-owned schema is filtered by tenantId.
//   - add a required `tenantId` field to the schema
//   - pre-hooks for find / findOne / updateOne / updateMany / deleteOne / deleteMany / countDocuments
//     / findOneAndUpdate: add { tenantId: getTenantId() } to the filter
//   - pre('save'): stamp tenantId from context
//   - pre('aggregate'): prepend a $match stage
//   - no tenant in context => throw, so a forgotten filter fails loudly instead of leaking data
// Laravel comparison: this is a global scope.
export function tenancyPlugin(_schema: Schema): void {
  // not implemented
}
