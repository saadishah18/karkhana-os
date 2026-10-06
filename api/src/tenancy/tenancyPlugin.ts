import type { Schema } from 'mongoose';
import { getTenantId } from './context.js';

export function tenancyPlugin(schema: Schema): void {
  // Every tenant-owned document carries a tenantId.
  schema.add({ tenantId: { type: String, required: true, index: true } });

  // DONE: stamp the tenant, so callers can never forget it or fake it.
  // Must be 'validate', not 'save': Mongoose validates BEFORE the save hooks run,
  // so a 'save' hook would be too late for `required: true`.
  schema.pre('validate', function () {
    this.tenantId = getTenantId();
  });

  // TODO (Saad): query hooks so find / findOne / updateOne / updateMany / deleteOne / deleteMany /
  //   countDocuments / findOneAndUpdate add { tenantId: getTenantId() } to the filter.
  //   (Mongoose: schema.pre(['find', ...], function () { this.where(...) }))
  // TODO (Saad): schema.pre('aggregate', ...) to prepend a $match stage.
  // TODO (Saad): no tenant in context => getTenantId() throws, so a forgotten filter fails loudly.
}
