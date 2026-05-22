const router = require('express').Router();
const Lead = require('../models/Lead');
const Provider = require('../models/Provider');

// GET /api/stats
router.get('/', async (req, res) => {
  const [totalLeads, providers, byService, byStatus] = await Promise.all([
    Lead.countDocuments(),
    Provider.find({}, 'leadsReceived monthlyQuota'),
    Lead.aggregate([
      { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'svc' } },
      { $unwind: '$svc' },
      { $group: { _id: '$svc.name', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const activeProviders = providers.filter((p) => p.leadsReceived > 0).length;
  const capacityUsed = providers.reduce((s, p) => s + p.leadsReceived, 0);
  const capacityTotal = providers.reduce((s, p) => s + p.monthlyQuota, 0);

  res.json({ totalLeads, activeProviders, capacityUsed, capacityTotal, byService, byStatus });
});

module.exports = router;
