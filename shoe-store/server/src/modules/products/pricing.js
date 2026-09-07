const { HttpError } = require('../../utils/httpError');

const DISCOUNT_ERROR = 'Discount percent must be between 0 and 100';

function normalizeDiscountPercent(value) {
  if (
    value === null
    || value === undefined
    || Array.isArray(value)
    || typeof value === 'object'
    || typeof value === 'boolean'
    || (typeof value === 'string' && value.trim() === '')
  ) {
    throw new HttpError(400, DISCOUNT_ERROR);
  }

  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new HttpError(400, DISCOUNT_ERROR);
  }

  return percent.toFixed(2);
}

function toCents(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100);
}

function calculateVariantPrice(basePrice, discountPercent, legacyPriceDelta = null) {
  const basePriceCents = toCents(basePrice);
  const normalizedDiscount = normalizeDiscountPercent(discountPercent);
  const discountBasisPoints = Math.round(Number(normalizedDiscount) * 100);

  if (legacyPriceDelta !== null && discountBasisPoints === 0) {
    return Math.max(0, basePriceCents + toCents(legacyPriceDelta)) / 100;
  }

  const discountedCents = Math.round(basePriceCents * (10000 - discountBasisPoints) / 10000);
  return Math.max(0, discountedCents) / 100;
}

module.exports = {
  calculateVariantPrice,
  normalizeDiscountPercent
};
