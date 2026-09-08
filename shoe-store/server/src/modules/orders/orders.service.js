const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transactions');
const { HttpError } = require('../../utils/httpError');
const { calculateVariantPrice } = require('../products/pricing');
const { createPaymentUrl } = require('../payments/vnpay.service');
const crypto = require('node:crypto');

const PAYMENT_METHODS = new Set(['cod', 'vnpay']);

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

function cleanOptionalText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizePaymentMethod(value) {
  const paymentMethod = String(value || 'cod').trim().toLowerCase();
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw new HttpError(400, 'Unsupported payment method');
  }
  return paymentMethod;
}

function generateOrderCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ORD-${date}-${suffix}`;
}

async function generateUniqueOrderCode(client) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderCode = generateOrderCode();
    const existing = await client.query(
      `
        SELECT id
        FROM orders
        WHERE order_code = $1
      `,
      [orderCode]
    );

    if (existing.rowCount === 0) {
      return orderCode;
    }
  }

  throw new HttpError(500, 'Could not generate order code');
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
    basePrice: toNumber(row.base_price) ?? null,
    discountPercent: toNumber(row.discount_percent) ?? null,
    quantity: Number(row.quantity),
    lineTotal: toNumber(row.line_total)
  };
}

function mapOrder(row, items = []) {
  return {
    id: Number(row.id),
    orderCode: row.order_code,
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
    note: row.note,
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
        p.base_price,
        pv.discount_percent,
        pv.legacy_pricing_active,
        to_jsonb(pv) ->> 'legacy_price_delta' AS legacy_price_delta
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

  return result.rows.map((row) => {
    const unitPrice = calculateVariantPrice(row.base_price, row.discount_percent, row.legacy_price_delta, row.legacy_pricing_active);
    return {
      ...row,
      unit_price: unitPrice,
      line_total: unitPrice * Number(row.quantity)
    };
  });
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
        base_price,
        discount_percent,
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

async function createOrder(userId, payload = {}, ipAddress = '') {
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const { receiverName, phone, shippingAddress, note } = payload;
  const customerName = requireText(receiverName, 'Receiver name is required');
  requireText(phone, 'Phone is required');
  const address = validateAddress(shippingAddress);
  const orderNote = cleanOptionalText(note);

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

    const subtotal = cartRows.reduce((sum, row) => sum + Number(row.line_total), 0);
    const orderResult = await client.query(
      `
        INSERT INTO orders (
          user_id,
          order_code,
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
          note,
          payment_method,
          payment_status,
          order_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending')
        RETURNING *
      `,
      [
        userId,
        await generateUniqueOrderCode(client),
        customer.email,
        customerName,
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postalCode,
        address.country,
        subtotal,
        subtotal,
        orderNote,
        paymentMethod,
        paymentMethod === 'vnpay' ? 'pending' : 'unpaid'
      ]
    );

    const order = orderResult.rows[0];
    const paymentUrl = paymentMethod === 'vnpay'
      ? createPaymentUrl({
          orderId: order.id,
          orderCode: order.order_code,
          amount: order.grand_total,
          ipAddress
        })
      : null;
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
            line_total,
            base_price,
            discount_percent
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          Number(item.unit_price),
          Number(item.quantity),
          Number(item.line_total),
          item.base_price,
          item.discount_percent
        ]
      );
      insertedItems.push(itemResult.rows[0]);

      const stockResult = await client.query(
        `
          UPDATE product_variants
          SET stock_quantity = stock_quantity - $1
          WHERE id = $2
            AND stock_quantity >= $1
          RETURNING id, stock_quantity
        `,
        [Number(item.quantity), item.product_variant_id]
      );
      if (stockResult.rowCount !== 1) {
        throw new HttpError(409, 'Requested quantity exceeds stock');
      }
    }

    await client.query(
      `
        DELETE FROM cart_items
        WHERE cart_id = $1
      `,
      [cartRows[0].cart_id]
    );

    const result = { order: mapOrder(order, insertedItems) };
    if (paymentUrl) {
      result.paymentUrl = paymentUrl;
    }
    return result;
  });
}

async function createCodOrder(userId, payload = {}) {
  const result = await createOrder(userId, { ...payload, paymentMethod: 'cod' });
  return result.order;
}

async function resumeVnpayPayment(userId, orderId, ipAddress) {
  const id = Number(orderId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid order id');
  }
  return withTransaction(async (client) => {
    const result = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId]
    );
    const order = result.rows[0];
    if (!order) throw new HttpError(404, 'Order not found');
    if (order.payment_method !== 'vnpay' || order.payment_status !== 'pending'
      || !['pending', 'confirmed'].includes(order.order_status)) {
      throw new HttpError(409, 'Only pending VNPay payments can be resumed');
    }
    return { paymentUrl: createPaymentUrl({
      orderId: order.id, orderCode: order.order_code, amount: order.grand_total, ipAddress
    }) };
  });
}

function amountInMinorUnits(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : null;
}

function paymentResult(code, message) {
  return { code, message };
}

async function reconcileVnpayPayment({ orderId, amount, responseCode, transactionStatus, transactionNo }) {
  const parsedOrderId = Number(orderId);
  if (!Number.isSafeInteger(parsedOrderId) || parsedOrderId <= 0) {
    return paymentResult('01', 'Order not found');
  }

  return withTransaction(async (client) => {
    const orderResult = await client.query(
      `
        SELECT
          id,
          grand_total,
          order_status,
          payment_status,
          vnpay_transaction_no,
          vnpay_amount
        FROM orders
        WHERE id = $1
          AND payment_method = 'vnpay'
        FOR UPDATE
      `,
      [parsedOrderId]
    );
    const order = orderResult.rows[0];

    if (!order) {
      return paymentResult('01', 'Order not found');
    }

    if (order.order_status === 'cancelled') {
      return paymentResult('02', 'Order already confirmed');
    }

    if (amountInMinorUnits(order.grand_total) !== amountInMinorUnits(amount)) {
      return paymentResult('04', 'Invalid Amount');
    }

    const normalizedTransactionNo = transactionNo === null || transactionNo === undefined
      ? null
      : String(transactionNo).trim() || null;
    const hasSameReconciliation = order.vnpay_transaction_no === normalizedTransactionNo
      && amountInMinorUnits(order.vnpay_amount) === amountInMinorUnits(amount);

    if (order.payment_status === 'paid' || order.payment_status === 'failed') {
      return hasSameReconciliation
        ? paymentResult('00', 'Confirm Success')
        : paymentResult('02', 'Order already confirmed');
    }

    if (order.payment_status !== 'pending') {
      return paymentResult('02', 'Order already confirmed');
    }

    if (!responseCode || !transactionStatus || !normalizedTransactionNo) {
      return paymentResult('99', 'Invalid transaction');
    }

    const successful = responseCode === '00' && transactionStatus === '00';

    await client.query(
      `
        UPDATE orders
        SET
          payment_status = $1,
          vnpay_transaction_no = $2,
          vnpay_amount = $3,
          vnpay_updated_at = NOW(),
          updated_at = NOW()
        WHERE id = $4
        RETURNING id
      `,
      [successful ? 'paid' : 'failed', normalizedTransactionNo, Number(amount).toFixed(2), parsedOrderId]
    );

    return paymentResult('00', 'Confirm Success');
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

async function cancelCustomerOrder(userId, orderId) {
  const parsedOrderId = Number(orderId);
  if (!Number.isSafeInteger(parsedOrderId) || parsedOrderId <= 0) {
    throw new HttpError(400, 'Invalid order id');
  }

  return withTransaction(async (client) => {
    const orderResult = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1
          AND user_id = $2
        FOR UPDATE
      `,
      [parsedOrderId, userId]
    );
    const order = orderResult.rows[0];
    if (!order) {
      throw new HttpError(404, 'Order not found');
    }
    if (!['pending', 'confirmed'].includes(order.order_status)) {
      throw new HttpError(409, 'This order can no longer be cancelled');
    }

    const items = await getOrderItems(parsedOrderId, client);
    for (const item of items) {
      if (item.product_variant_id === null || item.product_variant_id === undefined) {
        continue;
      }

      const stockResult = await client.query(
        `
          UPDATE product_variants
          SET stock_quantity = stock_quantity + $1
          WHERE id = $2
          RETURNING id
        `,
        [Number(item.quantity), item.product_variant_id]
      );
      if (stockResult.rowCount !== 1) {
        throw new HttpError(409, 'Unable to restore product variant stock');
      }
    }

    const nextPaymentStatus = order.payment_method === 'vnpay'
      ? order.payment_status === 'paid' ? 'refund_pending' : 'failed'
      : order.payment_status;
    const updated = await client.query(
      `
        UPDATE orders
        SET order_status = 'cancelled',
            payment_status = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [nextPaymentStatus, parsedOrderId]
    );

    return mapOrder(updated.rows[0], items);
  });
}

module.exports = {
  createOrder,
  resumeVnpayPayment,
  createCodOrder,
  reconcileVnpayPayment,
  listCustomerOrders,
  getCustomerOrder,
  cancelCustomerOrder,
  mapOrder
};
