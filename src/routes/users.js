const express = require('express');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUser(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const allowedFields = new Set(['name', 'email']);
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    return { error: `Unknown field(s): ${unknownFields.join(', ')}` };
  }

  if (partial && Object.keys(body).length === 0) {
    return { error: 'Provide at least one field to update' };
  }

  const user = {};

  if (!partial || Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.trim().length > 100) {
      return { error: 'name must be a non-empty string of at most 100 characters' };
    }
    user.name = body.name.trim();
  }

  if (!partial || Object.hasOwn(body, 'email')) {
    if (
      typeof body.email !== 'string' ||
      body.email.trim().length > 254 ||
      !EMAIL_PATTERN.test(body.email.trim())
    ) {
      return { error: 'email must be a valid email address of at most 254 characters' };
    }
    user.email = body.email.trim();
  }

  return { user };
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 4294967295 ? id : null;
}

function isDuplicateEmail(error) {
  return error && (
    error.code === 'ER_DUP_ENTRY' ||
    (error.code === 'SQLITE_CONSTRAINT_UNIQUE' && error.message.includes('users.email'))
  );
}

function usersRouter(pool) {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    const validation = validateUser(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    try {
      const [result] = await pool.execute(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        [validation.user.name, validation.user.email]
      );
      const [rows] = await pool.execute(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
        [result.insertId]
      );
      return res.status(201).json(rows[0]);
    } catch (error) {
      if (isDuplicateEmail(error)) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      return next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, email, created_at, updated_at FROM users ORDER BY id'
      );
      return res.json(rows);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    try {
      const [rows] = await pool.execute(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(rows[0]);
    } catch (error) {
      return next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    const validation = validateUser(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    try {
      await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [
        validation.user.name,
        validation.user.email,
        id
      ]);
      const [rows] = await pool.execute(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(rows[0]);
    } catch (error) {
      if (isDuplicateEmail(error)) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
      return next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }

    try {
      const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { usersRouter };
