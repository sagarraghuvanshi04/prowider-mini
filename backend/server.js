require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.CORS_ORIGIN || 'http://localhost:3000';
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    // Allow exact match or any Vercel preview URL for this project
    if (
      origin === allowed ||
      origin === 'http://localhost:3000' ||
      /\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
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
