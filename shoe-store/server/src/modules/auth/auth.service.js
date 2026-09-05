const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transactions');
const { HttpError } = require('../../utils/httpError');

const CUSTOMER_ROLE = 'customer';
const JWT_SECRET = process.env.JWT_SECRET || 'shoe-store-dev-secret';

function validateRegistration({ name, email, password }) {
  if (!name || !String(name).trim()) {
    throw new HttpError(400, 'Name is required');
  }

  if (!email || !String(email).includes('@')) {
    throw new HttpError(400, 'Email must contain @');
  }

  if (!password || String(password).length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }
}

function splitName(name) {
  const parts = String(name).trim().split(/\s+/);
  const firstName = parts.shift();
  return {
    firstName,
    lastName: parts.join(' ')
  };
}

function publicUser(row) {
  if (!row) {
    return null;
  }

  const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
  return {
    id: Number(row.id),
    email: row.email,
    name,
    role: row.role
  };
}

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

async function getUserById(id) {
  const result = await query(
    `
      SELECT id, email, password_hash, role, first_name, last_name
      FROM users
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function registerCustomer({ name, email, password }) {
  validateRegistration({ name, email, password });

  const normalizedEmail = String(email).trim().toLowerCase();
  const { firstName, lastName } = splitName(name);
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO users (email, password_hash, role, first_name, last_name)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, email, password_hash, role, first_name, last_name
        `,
        [normalizedEmail, passwordHash, CUSTOMER_ROLE, firstName, lastName]
      );

      return result.rows[0];
    });

    const publicProfile = publicUser(user);
    return { user: publicProfile, token: signToken(publicProfile) };
  } catch (error) {
    if (error.code === '23505') {
      throw new HttpError(409, 'Email already exists');
    }

    throw error;
  }
}

async function login({ email, password }) {
  const result = await query(
    `
      SELECT id, email, password_hash, role, first_name, last_name
      FROM users
      WHERE email = $1
    `,
    [String(email || '').trim().toLowerCase()]
  );

  const user = result.rows[0];
  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const publicProfile = publicUser(user);
  return { user: publicProfile, token: signToken(publicProfile) };
}

module.exports = {
  registerCustomer,
  login,
  getUserById,
  signToken,
  publicUser
};
