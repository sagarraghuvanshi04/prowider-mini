const router = require('express').Router();
const Provider = require('../models/Provider');
const Lead = require('../models/Lead');

// GET /api/providers — summary list
router.get('/', async (req, res) => {
  const providers = await Provider.find({}, 'name monthlyQuota leadsReceived').sort('name');
  res.json(providers);
});

// GET /api/providers/:id/leads
router.get('/:id/leads', async (req, res) => {
  const leads = await Lead.find({ assignedProviders: req.params.id })
    .populate('serviceId', '_id name')
    .populate('assignedProviders', '_id name')
    .sort({ createdAt: -1 });
  res.json(leads);
});

module.exports = router;
