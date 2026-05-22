require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/services', require('./routes/services'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/events', require('./routes/events'));
app.use('/api/stats', require('./routes/stats'));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 4000, () =>
      console.log(`Server running on port ${process.env.PORT || 4000}`)
    );
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
