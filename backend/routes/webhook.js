const router = require('express').Router();
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const Lead = require('../models/Lead');
const Service = require('../models/Service');
const WebhookEvent = require('../models/WebhookEvent');
const { assignProviders } = require('../lib/allocator');
const { broadcast } = require('../lib/sse');

/**
 * POST /api/webhook/reset-quota
 * Simulates payment gateway confirming subscription → resets all provider quotas.
 * Body: { eventId: string }  — idempotency key
 */
router.post('/reset-quota', async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  try {
    // Idempotency: insert eventId; if duplicate, it was already processed
    await WebhookEvent.create({ eventId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ message: 'Already processed', idempotent: true });
    }
    return res.status(500).json({ error: 'Internal error' });
  }

  await Provider.updateMany({}, { leadsReceived: 0, monthlyQuota: 10 });
  const providers = await Provider.find({}, 'name monthlyQuota leadsReceived').sort('name');
  broadcast('quota-reset', providers);
  res.json({ message: 'Quota reset successful', providers });
});

/**
 * POST /api/webhook/bulk-leads
 * Generates 10 leads concurrently to test concurrency handling.
 */
router.post('/bulk-leads', async (req, res) => {
  const services = await Service.find();
  if (!services.length) return res.status(400).json({ error: 'No services found' });

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) => {
      const service = services[i % services.length];
      const phone = `TEST${Date.now()}${i}`;
      return createLeadWithTransaction({ customerName: `Test User ${i}`, phone, city: 'TestCity', serviceId: service._id, description: 'Bulk test' });
    })
  );

  const created = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message);
  res.json({ created: created.length, failed });
});

async function createLeadWithTransaction({ customerName, phone, city, serviceId, description }) {
  const session = await mongoose.startSession();
  try {
    let lead;
    await session.withTransaction(async () => {
      const assignedProviders = await assignProviders(serviceId, session);
      const docs = await Lead.create([{ customerName, phone, city, serviceId, description, assignedProviders }], { session });
      lead = docs[0];
    });
    const populated = await Lead.findById(lead._id).populate('serviceId', 'name').populate('assignedProviders', 'name');
    broadcast('new-lead', populated);
    return populated;
  } finally {
    session.endSession();
  }
}

module.exports = router;
