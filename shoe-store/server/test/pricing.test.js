const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateVariantPrice,
  normalizeDiscountPercent
} = require('../src/modules/products/pricing');

test('keeps the base price at 0% discount', () => {
  assert.equal(calculateVariantPrice('100.00', 0), 100);
});

test('applies a 10% discount', () => {
  assert.equal(calculateVariantPrice('100.00', 10), 90);
});

test('returns zero at 100% discount', () => {
  assert.equal(calculateVariantPrice('100.00', 100), 0);
});

test('applies decimal discount percentages', () => {
  assert.equal(calculateVariantPrice('80.00', 12.5), 70);
});

test('rounds discounted unit prices to whole dong before multiplying quantities', () => {
  assert.equal(calculateVariantPrice('19.99', 33.33), 13);
  assert.equal(calculateVariantPrice('101.00', 50), 51);
  assert.equal(calculateVariantPrice('100.49', 0), 100);
});

test('uses the migrated price delta when discount remains zero', () => {
  assert.equal(calculateVariantPrice('89.99', 0, '5.00', true), 95);
  assert.equal(calculateVariantPrice('2.00', 0, '-5.00', true), 0);
});

test('an explicitly retired legacy delta cannot override a zero discount', () => {
  assert.equal(calculateVariantPrice('100.00', 0, '25.00', false), 100);
  assert.equal(calculateVariantPrice('100.00', 0, '25.00'), 100);
});

test('a configured discount takes precedence over a migrated price delta', () => {
  assert.equal(calculateVariantPrice('100.00', 10, '25.00'), 90);
});

test('normalizes discount percentages from 0 through 100', () => {
  assert.equal(normalizeDiscountPercent(0), '0.00');
  assert.equal(normalizeDiscountPercent('12.5'), '12.50');
  assert.equal(normalizeDiscountPercent(100), '100.00');
});

test('rejects invalid discount percentages with HTTP 400', () => {
  const invalidValues = [null, undefined, '', '   ', [], {}, false, 'abc', -0.01, 100.01];

  for (const value of invalidValues) {
    assert.throws(
      () => normalizeDiscountPercent(value),
      (error) => error.statusCode === 400 && error.message === 'Discount percent must be between 0 and 100'
    );
  }
});
