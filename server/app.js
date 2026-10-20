const path = require('path');
const express = require('express');
const helmet = require('helmet');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'], // question images are admin-supplied https links
        scriptSrc: ["'self'"],
      },
    },
  }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', routes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body isn’t valid JSON.' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side.' : err.message });
  });
  return app;
}

module.exports = createApp;
