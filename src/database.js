const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function createDatabase(databasePath = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'users.sqlite')) {
  const resolvedPath = databasePath === ':memory:' ? databasePath : path.resolve(databasePath);

  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const database = new Database(resolvedPath);
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  database.exec(schema);

  const seedMarker = database.prepare(
    'SELECT value FROM app_metadata WHERE key = ?'
  ).get('sample_users_seeded');

  if (!seedMarker) {
    const seedUsers = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'users.json'), 'utf8')
    );
    if (!Array.isArray(seedUsers)) {
      database.close();
      throw new Error('data/users.json must contain an array of users');
    }

    const insertUser = database.prepare(
      'INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)'
    );
    const seed = database.transaction(() => {
      for (const user of seedUsers) {
        if (
          !user ||
          typeof user.name !== 'string' ||
          typeof user.email !== 'string'
        ) {
          throw new Error('Each entry in data/users.json must have a name and email');
        }
        insertUser.run(user.name, user.email);
      }
      database.prepare(
        'INSERT INTO app_metadata (key, value) VALUES (?, ?)'
      ).run('sample_users_seeded', 'true');
    });
    seed();
  }

  return {
    async execute(sql, values = []) {
      const statement = database.prepare(sql);
      if (statement.reader) {
        return [statement.all(...values)];
      }

      const result = statement.run(...values);
      return [{
        insertId: Number(result.lastInsertRowid),
        affectedRows: result.changes
      }];
    },
    close() {
      database.close();
    }
  };
}

module.exports = { createDatabase };
