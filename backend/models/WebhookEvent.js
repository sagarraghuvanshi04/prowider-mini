const mongoose = require('mongoose');

// Tracks processed webhook event IDs for idempotency
const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  processedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
