import { Schema, model } from 'mongoose';
import { tenancyPlugin } from '../tenancy/tenancyPlugin.js';

const invoiceSchema = new Schema({
  number: { type: String, required: true },
  totalPaisa: { type: Number, required: true }, // integer paisa, never floats
});

invoiceSchema.plugin(tenancyPlugin);

export const Invoice = model('Invoice', invoiceSchema);
