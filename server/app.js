const fs = require('fs');
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

  // The React app, built by `npm run build`. Every non-API path returns index.html so React Router can handle it.
  const web = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(web));
  app.get('*', (req, res) => {
    const index = path.join(web, 'index.html');
    if (fs.existsSync(index)) return res.sendFile(index);
    res.status(503).type('text').send('The front end hasn’t been built yet. Run `npm run build`, or use `npm run dev` while developing.');
  });

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
