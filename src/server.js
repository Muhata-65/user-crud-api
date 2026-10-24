require('dotenv').config();

const { createApp } = require('./app');
const { createDatabase } = require('./database');

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535');
  process.exit(1);
}

const database = createDatabase();
const app = createApp(database);
const server = app.listen(port, () => {
  console.log(`Users API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async (serverError) => {
    if (serverError) {
      console.error('Failed to close the HTTP server:', serverError);
      process.exitCode = 1;
    }

    try {
      database.close();
    } catch (databaseError) {
      console.error('Failed to close the SQLite database:', databaseError);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
