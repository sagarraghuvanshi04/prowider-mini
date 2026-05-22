const Service = require('../models/Service');
const Provider = require('../models/Provider');

const MANDATORY_RULES = {
  'Service 1': ['Provider 1'],
  'Service 2': ['Provider 5'],
  'Service 3': ['Provider 1', 'Provider 4'],
};

const POOL_RULES = {
  'Service 1': ['Provider 2', 'Provider 3', 'Provider 4'],
  'Service 2': ['Provider 6', 'Provider 7', 'Provider 8'],
  'Service 3': ['Provider 2', 'Provider 3', 'Provider 5', 'Provider 6', 'Provider 7', 'Provider 8'],
};

const TOTAL_ASSIGNMENTS = 3;

/**
 * Assigns exactly 3 providers to a lead.
 * Must be called inside a MongoDB transaction (session).
 *
 * Strategy:
 *  1. Assign mandatory providers (skip if quota full).
 *  2. Fill remaining slots from the fair pool using round-robin (lowest rrCounter first).
 *  3. Atomically increment leadsReceived (with quota guard) and rrCounter.
 *
 * Concurrency safety: findOneAndUpdate with leadsReceived < monthlyQuota guard
 * ensures no provider exceeds quota even under simultaneous requests.
 */
async function assignProviders(serviceId, session) {
  const service = await Service.findById(serviceId).session(session);
  if (!service) throw new Error('Service not found');

  const mandatoryNames = MANDATORY_RULES[service.name] || [];
  const poolNames = POOL_RULES[service.name] || [];
  const allNames = [...new Set([...mandatoryNames, ...poolNames])];

  // Read current state inside the transaction
  const providers = await Provider.find({ name: { $in: allNames } }).session(session);
  const byName = Object.fromEntries(providers.map((p) => [p.name, p]));

  const assigned = [];

  // Step 1: mandatory providers
  for (const name of mandatoryNames) {
    const p = byName[name];
    if (p && p.leadsReceived < p.monthlyQuota) {
      assigned.push(p);
    }
  }

  // Step 2: round-robin fill from pool
  const slotsNeeded = TOTAL_ASSIGNMENTS - assigned.length;
  if (slotsNeeded > 0) {
    const assignedIds = new Set(assigned.map((p) => p._id.toString()));
    const serviceKey = serviceId.toString();

    const eligible = poolNames
      .map((n) => byName[n])
      .filter((p) => p && !assignedIds.has(p._id.toString()) && p.leadsReceived < p.monthlyQuota);

    // Sort by rrCounter ascending (round-robin), break ties by name
    eligible.sort((a, b) => {
      const ca = (a.rrCounters && a.rrCounters.get(serviceKey)) || 0;
      const cb = (b.rrCounters && b.rrCounters.get(serviceKey)) || 0;
      return ca !== cb ? ca - cb : a.name.localeCompare(b.name);
    });

    for (let i = 0; i < slotsNeeded && i < eligible.length; i++) {
      assigned.push(eligible[i]);
    }
  }

  // Step 3: atomically commit assignments
  const serviceKey = serviceId.toString();
  const confirmedIds = [];

  for (const p of assigned) {
    const isPool = poolNames.includes(p.name);
    const inc = { leadsReceived: 1 };
    if (isPool) inc[`rrCounters.${serviceKey}`] = 1;

    // Guard: only increment if still under quota (handles concurrent requests)
    const updated = await Provider.findOneAndUpdate(
      { _id: p._id, leadsReceived: { $lt: p.monthlyQuota } },
      { $inc: inc },
      { session, new: true }
    );

    if (updated) confirmedIds.push(p._id);
  }

  return confirmedIds;
}

module.exports = { assignProviders };
