const express = require('express');
const path = require('node:path');
const { usersRouter } = require('./routes/users');

function createApp(pool) {
  const app = express();

  app.use(express.json({ limit: '10kb' }));
  app.use('/api/users', usersRouter(pool));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Request body must contain valid JSON' });
    }

    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }

    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
