const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    description: { type: String },
    assignedProviders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'closed'],
      default: 'new',
    },
  },
  { timestamps: true }
);

leadSchema.index({ phone: 1, serviceId: 1 }, { unique: true });

module.exports = mongoose.model('Lead', leadSchema);
