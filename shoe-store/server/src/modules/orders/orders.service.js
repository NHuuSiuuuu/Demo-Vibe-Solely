const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transactions');
const { HttpError } = require('../../utils/httpError');

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function requireText(value, message) {
  const text = String(value || '').trim();
  if (!text) {
    throw new HttpError(400, message);
  }
  return text;
}

function mapOrderItem(row) {
  return {
    id: Number(row.id),
    productId: row.product_id === null || row.product_id === undefined ? null : Number(row.product_id),
    variantId: row.product_variant_id === null || row.product_variant_id === undefined ? null : Number(row.product_variant_id),
    productName: row.product_name,
    sku: row.sku,
    size: row.size,
    color: row.color,
    unitPrice: toNumber(row.unit_price),
    quantity: Number(row.quantity),
    lineTotal: toNumber(row.line_total)
  };
}

function mapOrder(row, items = []) {
  return {
    id: Number(row.id),
    userId: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    shippingAddress: {
      line1: row.shipping_address_line1,
      line2: row.shipping_address_line2,
      city: row.shipping_city,
      state: row.shipping_state,
      postalCode: row.shipping_postal_code,
      country: row.shipping_country
    },
    subtotal: toNumber(row.subtotal),
    shippingTotal: toNumber(row.shipping_total),
    taxTotal: toNumber(row.tax_total),
    grandTotal: toNumber(row.grand_total),
    orderStatus: row.order_status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    items: items.map(mapOrderItem)
  };
}

function validateAddress(address = {}) {
  return {
    line1: requireText(address.line1, 'Shipping address line1 is required'),
    line2: String(address.line2 || '').trim() || null,
    city: requireText(address.city, 'Shipping city is required'),
    state: requireText(address.state, 'Shipping state is required'),
    postalCode: requireText(address.postalCode, 'Shipping postal code is required'),
    country: String(address.country || 'US').trim() || 'US'
  };
}

async function getCustomer(userId, client) {
  const result = await client.query(
    `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getCartSnapshot(userId, client) {
  const result = await client.query(
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
        (p.base_price + pv.price_delta) AS unit_price,
        ((p.base_price + pv.price_delta) * ci.quantity) AS line_total
      FROM carts c
      JOIN cart_items ci ON ci.cart_id = c.id
      JOIN product_variants pv ON pv.id = ci.product_variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE c.user_id = $1
      ORDER BY ci.id ASC
      FOR UPDATE
    `,
    [userId]
  );

  return result.rows;
}

async function lockVariants(variantIds, client) {
  const result = await client.query(
    `
      SELECT id, stock_quantity
      FROM product_variants pv
      WHERE pv.id = ANY($1::BIGINT[])
      FOR UPDATE
    `,
    [variantIds]
  );

  return new Map(result.rows.map((row) => [Number(row.id), Number(row.stock_quantity)]));
}

async function getOrderItems(orderId, client = { query }) {
  const result = await client.query(
    `
      SELECT
        id,
        product_id,
        product_variant_id,
        product_name,
        sku,
        size,
        color,
        unit_price,
        quantity,
        line_total
      FROM order_items
      WHERE order_id = $1
      ORDER BY id ASC
    `,
    [orderId]
  );

  return result.rows;
}

async function createCodOrder(userId, { receiverName, phone, shippingAddress, note }) {
  const customerName = requireText(receiverName, 'Receiver name is required');
  requireText(phone, 'Phone is required');
  const address = validateAddress(shippingAddress);
  void note;

  return withTransaction(async (client) => {
    const customer = await getCustomer(userId, client);
    if (!customer) {
      throw new HttpError(401, 'Invalid token');
    }

    const cartRows = await getCartSnapshot(userId, client);
    if (cartRows.length === 0) {
      throw new HttpError(400, 'Cart is empty');
    }

    const stockByVariantId = await lockVariants(
      cartRows.map((row) => Number(row.product_variant_id)),
      client
    );

    for (const item of cartRows) {
      const availableStock = stockByVariantId.get(Number(item.product_variant_id));
      if (availableStock === undefined || Number(item.quantity) > availableStock) {
        throw new HttpError(409, 'Requested quantity exceeds stock');
      }
    }

    const subtotal = Number(cartRows.reduce((sum, row) => sum + Number(row.line_total), 0).toFixed(2));
    const orderResult = await client.query(
      `
        INSERT INTO orders (
          user_id,
          customer_email,
          customer_name,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_state,
          shipping_postal_code,
          shipping_country,
          subtotal,
          grand_total,
          payment_method,
          payment_status,
          order_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'cod', 'unpaid', 'pending')
        RETURNING *
      `,
      [
        userId,
        customer.email,
        customerName,
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postalCode,
        address.country,
        subtotal.toFixed(2),
        subtotal.toFixed(2)
      ]
    );

    const order = orderResult.rows[0];
    const insertedItems = [];
    for (const item of cartRows) {
      const itemResult = await client.query(
        `
          INSERT INTO order_items (
            order_id,
            product_id,
            product_variant_id,
            product_name,
            sku,
            size,
            color,
            unit_price,
            quantity,
            line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        [
          order.id,
          item.product_id,
          item.product_variant_id,
          item.product_name,
          item.sku,
          item.size,
          item.color,
          Number(item.unit_price).toFixed(2),
          Number(item.quantity),
          Number(item.line_total).toFixed(2)
        ]
      );
      insertedItems.push(itemResult.rows[0]);

      await client.query(
        `
          UPDATE product_variants
          SET stock_quantity = stock_quantity - $1
          WHERE id = $2
            AND stock_quantity >= $1
          RETURNING id, stock_quantity
        `,
        [Number(item.quantity), item.product_variant_id]
      );
    }

    await client.query(
      `
        DELETE FROM cart_items
        WHERE cart_id = $1
      `,
      [cartRows[0].cart_id]
    );

    return mapOrder(order, insertedItems);
  });
}

async function listCustomerOrders(userId) {
  const result = await query(
    `
      SELECT *
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [userId]
  );

  return result.rows.map((row) => mapOrder(row));
}

async function getCustomerOrder(userId, orderId) {
  const result = await query(
    `
      SELECT *
      FROM orders
      WHERE user_id = $1
        AND id = $2
    `,
    [userId, orderId]
  );

  const order = result.rows[0];
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }

  const items = await getOrderItems(order.id);
  return mapOrder(order, items);
}

module.exports = {
  createCodOrder,
  listCustomerOrders,
  getCustomerOrder,
  mapOrder
};
