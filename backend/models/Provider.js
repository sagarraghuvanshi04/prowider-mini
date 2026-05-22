const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  monthlyQuota: { type: Number, default: 10 },
  leadsReceived: { type: Number, default: 0 },
  // Round-robin counter per service pool (keyed by serviceId string)
  rrCounters: { type: Map, of: Number, default: {} },
});

module.exports = mongoose.model('Provider', providerSchema);
