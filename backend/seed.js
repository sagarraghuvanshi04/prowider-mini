require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('./models/Service');
const Provider = require('./models/Provider');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  // Services
  const serviceNames = ['Service 1', 'Service 2', 'Service 3'];
  for (const name of serviceNames) {
    await Service.updateOne({ name }, { name }, { upsert: true });
  }

  // Providers
  for (let i = 1; i <= 8; i++) {
    await Provider.updateOne(
      { name: `Provider ${i}` },
      { $setOnInsert: { name: `Provider ${i}`, monthlyQuota: 10, leadsReceived: 0, rrCounters: {} } },
      { upsert: true }
    );
  }

  console.log('Seed complete');
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
