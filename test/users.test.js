const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../src/app');
const { createDatabase } = require('../src/database');

const users = new Map();
let nextId = 1;
let server;
let baseUrl;

const pool = {
  async execute(sql, values = []) {
    if (sql.startsWith('INSERT INTO users')) {
      const [name, email] = values;
      if ([...users.values()].some((user) => user.email === email)) {
        const error = new Error('Duplicate email');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      const id = nextId++;
      const timestamp = new Date().toISOString();
      users.set(id, { id, name, email, created_at: timestamp, updated_at: timestamp });
      return [{ insertId: id }];
    }

    if (sql.startsWith('SELECT') && sql.includes('ORDER BY id')) {
      return [[...users.values()].sort((a, b) => a.id - b.id)];
    }

    if (sql.startsWith('SELECT')) {
      const user = users.get(Number(values[0]));
      return [user ? [user] : []];
    }

    if (sql.startsWith('UPDATE users')) {
      const id = Number(values[2]);
      const user = users.get(id);
      if (!user) {
        return [{ affectedRows: 0 }];
      }

      user.name = values[0];
      user.email = values[1];
      user.updated_at = new Date().toISOString();
      return [{ affectedRows: 1 }];
    }

    if (sql.startsWith('DELETE FROM users')) {
      return [{ affectedRows: users.delete(Number(values[0])) ? 1 : 0 }];
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  }
};

before(async () => {
  users.clear();
  nextId = 1;
  server = createApp(pool).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, options) {
  return fetch(`${baseUrl}${path}`, options);
}

function json(body, method = 'POST') {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

test('POST creates a user and rejects invalid or duplicate input', async () => {
  const response = await request('/api/users', json({ name: ' Ada Lovelace ', email: 'ada@example.com' }));
  assert.equal(response.status, 201);
  const user = await response.json();
  assert.equal(user.name, 'Ada Lovelace');
  assert.equal(user.email, 'ada@example.com');
  assert.equal(typeof user.id, 'number');

  const invalid = await request('/api/users', json({ name: '', email: 'not-an-email' }));
  assert.equal(invalid.status, 400);

  const duplicate = await request('/api/users', json({ name: 'Other', email: 'ada@example.com' }));
  assert.equal(duplicate.status, 409);
});

test('GET lists users and returns a user by id', async () => {
  const list = await request('/api/users');
  assert.equal(list.status, 200);
  assert.equal((await list.json()).length, 1);

  const found = await request('/api/users/1');
  assert.equal(found.status, 200);
  assert.equal((await found.json()).name, 'Ada Lovelace');

  assert.equal((await request('/api/users/invalid')).status, 400);
  assert.equal((await request('/api/users/999')).status, 404);
});

test('PUT replaces user fields and validates missing users', async () => {
  const updated = await request('/api/users/1', json({ name: 'Ada Byron', email: 'ada@example.com' }, 'PUT'));
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).name, 'Ada Byron');

  assert.equal((await request('/api/users/1', json({ name: 'Ada Byron' }, 'PUT'))).status, 400);
  assert.equal((await request('/api/users/999', json({ name: 'Missing', email: 'missing@example.com' }, 'PUT'))).status, 404);
});

test('DELETE removes a user and reports missing users', async () => {
  assert.equal((await request('/api/users/1', { method: 'DELETE' })).status, 204);
  assert.equal((await request('/api/users/1', { method: 'DELETE' })).status, 404);
  assert.equal((await request('/api/users/1')).status, 404);
});

test('malformed JSON returns a client error', async () => {
  const response = await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid JSON/);
});

test('SQLite database supports user creation and case-insensitive duplicate emails', async () => {
  const database = createDatabase(':memory:');
  const sqliteServer = createApp(database).listen(0);
  await new Promise((resolve) => sqliteServer.once('listening', resolve));
  const sqliteBaseUrl = `http://127.0.0.1:${sqliteServer.address().port}`;

  try {
    const initialList = await fetch(`${sqliteBaseUrl}/api/users`);
    assert.equal((await initialList.json()).length, 4);

    const created = await fetch(`${sqliteBaseUrl}/api/users`, json({
      name: 'Grace Hopper',
      email: 'grace@example.com'
    }));
    assert.equal(created.status, 201);

    const duplicate = await fetch(`${sqliteBaseUrl}/api/users`, json({
      name: 'Another Grace',
      email: 'GRACE@example.com'
    }));
    assert.equal(duplicate.status, 409);

    const list = await fetch(`${sqliteBaseUrl}/api/users`);
    assert.equal(list.status, 200);
    assert.equal((await list.json()).length, 5);
  } finally {
    await new Promise((resolve, reject) => {
      sqliteServer.close((error) => (error ? reject(error) : resolve()));
    });
    database.close();
  }
});

test('serves the CRUD web interface at the root URL', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /User directory/);

  const script = await request('/app.js');
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);

  const stylesheet = await request('/styles.css');
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('content-type'), /text\/css/);
});
