const jwt = require('jsonwebtoken');
const { getUserById, publicUser } = require('../modules/auth/auth.service');
const { HttpError } = require('../utils/httpError');

const JWT_SECRET = process.env.JWT_SECRET || 'shoe-store-dev-secret';

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      throw new HttpError(401, 'Authentication required');
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new HttpError(401, 'Invalid token');
    }

    const user = await getUserById(payload.sub);
    if (!user) {
      throw new HttpError(401, 'Invalid token');
    }

    req.user = publicUser(user);
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new HttpError(403, 'Admin access required'));
  }

  return next();
}

function requireCustomer(req, res, next) {
  if (!req.user || req.user.role !== 'customer') {
    return next(new HttpError(403, 'Customer access required'));
  }

  return next();
}

module.exports = { requireAuth, requireAdmin, requireCustomer };
