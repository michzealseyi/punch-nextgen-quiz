require('dotenv').config();
const createApp = require('./app');
const seed = require('./seed');

if (seed()) console.log('First run: database seeded with quizzes, rewards and an admin account.');
const PORT = process.env.PORT || 3000;
createApp().listen(PORT, () => console.log(`PUNCH NextGen running on http://localhost:${PORT}`));
