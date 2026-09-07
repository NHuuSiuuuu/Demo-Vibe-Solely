const { query } = require('../../db/pool');
const { HttpError } = require('../../utils/httpError');
const { calculateVariantPrice } = require('../products/pricing');

function parsePositiveInteger(value, fieldName = 'Quantity') {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new HttpError(400, `${fieldName} must be positive`);
  }
  return number;
}

function mapCart(rows) {
  const items = rows.map((row) => {
    const quantity = Number(row.quantity);
    const unitPrice = calculateVariantPrice(row.base_price, row.discount_percent, row.legacy_price_delta);
    return {
      id: Number(row.item_id),
      variantId: Number(row.product_variant_id),
      productId: Number(row.product_id),
      productName: row.product_name,
      sku: row.sku,
      size: row.size,
      color: row.color,
      quantity,
      stockQuantity: Number(row.stock_quantity),
      unitPrice,
      lineTotal: Math.round(unitPrice * 100) * quantity / 100
    };
  });

  return {
    id: rows[0] ? Number(rows[0].cart_id) : null,
    items,
    subtotal: Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2))
  };
}

async function getOrCreateCart(userId) {
  const existing = await query(
    `
      SELECT id, user_id
      FROM carts
      WHERE user_id = $1
    `,
    [userId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await query(
    `
      INSERT INTO carts (user_id)
      VALUES ($1)
      RETURNING id, user_id
    `,
    [userId]
  );

  return created.rows[0];
}

async function getVariant(variantId) {
  const result = await query(
    `
      SELECT
        pv.id,
        pv.product_id,
        p.name AS product_name,
        pv.sku,
        pv.size,
        pv.color,
        pv.stock_quantity,
        p.base_price,
        pv.discount_percent,
        to_jsonb(pv) ->> 'legacy_price_delta' AS legacy_price_delta
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = $1
    `,
    [variantId]
  );

  return result.rows[0] || null;
}

async function getCartRows(userId) {
  const cart = await getOrCreateCart(userId);
  const result = await query(
    `
      SELECT
        c.id AS cart_id,
        ci.id AS item_id,
        ci.product_variant_id,
        ci.quantity,
        p.id AS product_id,
        p.name AS product_name,
        pv.sku,
        pv.size,
        pv.color,
        pv.stock_quantity,
        p.base_price,
        pv.discount_percent,
        to_jsonb(pv) ->> 'legacy_price_delta' AS legacy_price_delta
      FROM carts c
      LEFT JOIN cart_items ci ON ci.cart_id = c.id
      LEFT JOIN product_variants pv ON pv.id = ci.product_variant_id
      LEFT JOIN products p ON p.id = pv.product_id
      WHERE c.user_id = $1
        AND ci.id IS NOT NULL
      ORDER BY ci.id ASC
    `,
    [userId]
  );

  return { cart, rows: result.rows };
}

async function getCart(userId) {
  const { cart, rows } = await getCartRows(userId);
  const mapped = mapCart(rows);
  mapped.id = Number(cart.id);
  return mapped;
}

async function addCartItem(userId, { variantId, quantity } = {}) {
  const parsedVariantId = parsePositiveInteger(variantId, 'Variant id');
  const parsedQuantity = parsePositiveInteger(quantity);
  const cart = await getOrCreateCart(userId);
  const variant = await getVariant(parsedVariantId);

  if (!variant) {
    throw new HttpError(404, 'Product variant not found');
  }

  const existing = await query(
    `
      SELECT id, quantity
      FROM cart_items
      WHERE cart_id = $1
        AND product_variant_id = $2
    `,
    [cart.id, parsedVariantId]
  );

  const totalQuantity = Number(existing.rows[0]?.quantity || 0) + parsedQuantity;
  if (totalQuantity > Number(variant.stock_quantity)) {
    throw new HttpError(409, 'Requested quantity exceeds stock');
  }

  if (existing.rows[0]) {
    await query(
      `
        UPDATE cart_items
        SET quantity = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, quantity
      `,
      [existing.rows[0].id, totalQuantity]
    );
  } else {
    await query(
      `
        INSERT INTO cart_items (cart_id, product_variant_id, quantity)
        VALUES ($1, $2, $3)
        RETURNING id, quantity
      `,
      [cart.id, parsedVariantId, parsedQuantity]
    );
  }

  return getCart(userId);
}

async function updateCartItem(userId, itemId, { quantity } = {}) {
  const parsedItemId = parsePositiveInteger(itemId, 'Cart item id');
  const parsedQuantity = parsePositiveInteger(quantity);
  const { cart, rows } = await getCartRows(userId);
  const item = rows.find((row) => Number(row.item_id) === parsedItemId);

  if (!item) {
    throw new HttpError(404, 'Cart item not found');
  }

  if (parsedQuantity > Number(item.stock_quantity)) {
    throw new HttpError(409, 'Requested quantity exceeds stock');
  }

  await query(
    `
      UPDATE cart_items
      SET quantity = $1, updated_at = NOW()
      WHERE id = $2
        AND cart_id = $3
      RETURNING id, quantity
    `,
    [parsedQuantity, parsedItemId, cart.id]
  );

  return getCart(userId);
}

async function removeCartItem(userId, itemId) {
  const parsedItemId = parsePositiveInteger(itemId, 'Cart item id');
  const cart = await getOrCreateCart(userId);
  const result = await query(
    `
      DELETE FROM cart_items
      WHERE id = $1
        AND cart_id = $2
      RETURNING id
    `,
    [parsedItemId, cart.id]
  );

  if (!result.rows[0]) {
    throw new HttpError(404, 'Cart item not found');
  }

  return getCart(userId);
}

module.exports = {
  getOrCreateCart,
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  mapCart,
  parsePositiveInteger
};
