import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Invoice } from '../src/models/invoice.js';
import { runWithTenant } from '../src/tenancy/context.js';

const URI = process.env.MONGO_TEST_URI ??
  'mongodb://localhost:27018/karkhana_test?replicaSet=rs0&directConnection=true';

beforeAll(async () => {
  await mongoose.connect(URI);
});

beforeEach(async () => {
  // test-only cleanup that bypasses the plugin on purpose
  await mongoose.connection.collection('invoices').deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('tenant isolation', () => {
  it('stamps the tenantId from context on save', async () => {
    const doc = await runWithTenant('t_rashid', () =>
      Invoice.create({ number: 'INV-1', totalPaisa: 6_000_000 }),
    );
    expect((doc as any).tenantId).toBe('t_rashid');
  });

  it("tenant B never sees tenant A's invoices", async () => {
    await runWithTenant('t_rashid', () => Invoice.create({ number: 'INV-1', totalPaisa: 100 }));

    const asFans = await runWithTenant('t_fans', () => Invoice.find({}));
    expect(asFans).toHaveLength(0);

    const asRashid = await runWithTenant('t_rashid', () => Invoice.find({}));
    expect(asRashid).toHaveLength(1);
  });

  it("tenant B cannot update or delete tenant A's invoice", async () => {
    const a = await runWithTenant('t_rashid', () =>
      Invoice.create({ number: 'INV-1', totalPaisa: 100 }),
    );

    const upd = await runWithTenant('t_fans', () =>
      Invoice.updateOne({ _id: a._id }, { totalPaisa: 1 }),
    );
    expect(upd.matchedCount).toBe(0);

    const del = await runWithTenant('t_fans', () => Invoice.deleteOne({ _id: a._id }));
    expect(del.deletedCount).toBe(0);

    const still = await runWithTenant('t_rashid', () => Invoice.findById(a._id));
    expect(still?.totalPaisa).toBe(100);
  });

  it("aggregate is also filtered by tenant", async () => {
    await runWithTenant('t_rashid', () => Invoice.create({ number: 'INV-1', totalPaisa: 100 }));
    const rows = await runWithTenant('t_fans', () => Invoice.aggregate([{ $count: 'n' }]));
    expect(rows).toHaveLength(0);
  });

  it('throws when there is no tenant in context (fails loudly)', async () => {
    await expect(Invoice.find({})).rejects.toThrow();
  });
});
