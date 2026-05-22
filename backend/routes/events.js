const router = require('express').Router();
const { addClient } = require('../lib/sse');

// GET /api/events — SSE stream
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': connected\n\n');
  addClient(res);
});

module.exports = router;
