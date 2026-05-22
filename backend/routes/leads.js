const router = require('express').Router();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { assignProviders } = require('../lib/allocator');
const { broadcast } = require('../lib/sse');

// POST /api/leads
router.post('/', async (req, res) => {
  const { customerName, phone, city, serviceId, description } = req.body;
  if (!customerName || !phone || !city || !serviceId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const session = await mongoose.startSession();
  try {
    let lead;
    await session.withTransaction(async () => {
      const existing = await Lead.findOne({ phone, serviceId }).session(session);
      if (existing) throw Object.assign(new Error('Duplicate lead'), { code: 'DUPLICATE' });

      const assignedProviders = await assignProviders(serviceId, session);
      const docs = await Lead.create(
        [{ customerName, phone, city, serviceId, description, assignedProviders }],
        { session }
      );
      lead = docs[0];
    });

    const populated = await Lead.findById(lead._id)
      .populate('serviceId', 'name')
      .populate('assignedProviders', 'name');

    broadcast('new-lead', populated);
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 'DUPLICATE' || err.code === 11000) {
      return res.status(409).json({ error: 'You have already submitted a lead for this service.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    session.endSession();
  }
});

// GET /api/leads — all leads with optional ?serviceId= and ?status= filters
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.serviceId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.serviceId))
      return res.status(400).json({ error: 'Invalid serviceId' });
    filter.serviceId = req.query.serviceId;
  }
  const validStatuses = ['new', 'contacted', 'converted', 'closed'];
  if (req.query.status) {
    if (!validStatuses.includes(req.query.status))
      return res.status(400).json({ error: 'Invalid status' });
    filter.status = req.query.status;
  }
  const leads = await Lead.find(filter)
    .populate('serviceId', 'name')
    .populate('assignedProviders', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(leads);
});

// PATCH /api/leads/:id/status — update lead status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['new', 'contacted', 'converted', 'closed'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate('serviceId', 'name').populate('assignedProviders', 'name');
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  broadcast('lead-updated', lead);
  res.json(lead);
});

module.exports = router;
