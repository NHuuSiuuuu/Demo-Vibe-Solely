const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const originalLoad = Module._load;

process.env.JWT_SECRET = 'test-jwt-secret';

let users;
let products;
let variants;
let carts;
let cartItems;
let orders;
let orderItems;
let nextCartId;
let nextCartItemId;
let nextOrderId;
let nextOrderItemId;
let lockedVariants;

function resetStore() {
  users = [
    {
      id: 1,
      email: 'customer@example.com',
      password_hash: 'hash',
      role: 'customer',
      first_name: 'Sample',
      last_name: 'Customer'
    },
    {
      id: 2,
      email: 'other@example.com',
      password_hash: 'hash',
      role: 'customer',
      first_name: 'Other',
      last_name: 'Customer'
    }
  ];
  products = [{ id: 10, name: 'Road Runner 1', base_price: '89.99' }];
  variants = [
    {
      id: 101,
      product_id: 10,
      sku: 'RR1-9-BLK',
      size: '9',
      color: 'black',
      stock_quantity: 5,
      price_delta: '0.00'
    }
  ];
  carts = [];
  cartItems = [];
  orders = [
    {
      id: 900,
      user_id: 2,
      customer_email: 'other@example.com',
      customer_name: 'Other Customer',
      shipping_address_line1: '2 Market St',
      shipping_address_line2: null,
      shipping_city: 'Boston',
      shipping_state: 'MA',
      shipping_postal_code: '02108',
      shipping_country: 'US',
      subtotal: '89.99',
      shipping_total: '0.00',
      tax_total: '0.00',
      grand_total: '89.99',
      order_status: 'pending',
      payment_method: 'cod',
      payment_status: 'unpaid',
      created_at: '2026-09-05T00:00:00.000Z'
    }
  ];
  orderItems = [];
  nextCartId = 1;
  nextCartItemId = 1;
  nextOrderId = 1000;
  nextOrderItemId = 1;
  lockedVariants = [];
}

function tokenFor(userId) {
  const user = users.find((candidate) => candidate.id === userId);
  return jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function dbUser(user) {
  return user ? { ...user } : null;
}

function cartRow(cart) {
  return cart ? { ...cart } : null;
}

function fullCartRows(userId) {
  const cart = carts.find((candidate) => candidate.user_id === Number(userId));
  if (!cart) {
    return [];
  }

  return cartItems
    .filter((item) => item.cart_id === cart.id)
    .map((item) => {
      const variant = variants.find((candidate) => candidate.id === item.product_variant_id);
      const product = products.find((candidate) => candidate.id === variant.product_id);
      const unitPrice = Number(product.base_price) + Number(variant.price_delta);

      return {
        cart_id: cart.id,
        item_id: item.id,
        product_variant_id: variant.id,
        quantity: item.quantity,
        product_id: product.id,
        product_name: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        stock_quantity: variant.stock_quantity,
        unit_price: unitPrice.toFixed(2),
        line_total: (unitPrice * item.quantity).toFixed(2)
      };
    });
}

function orderRowsFor(userId) {
  return orders.filter((order) => order.user_id === Number(userId)).map((order) => ({ ...order }));
}

function orderItemRows(orderId) {
  return orderItems.filter((item) => item.order_id === Number(orderId)).map((item) => ({ ...item }));
}

function requireVariant(id) {
  return variants.find((variant) => variant.id === Number(id));
}

async function mockQuery(text, params = []) {
  if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
    const user = users.find((candidate) => String(candidate.id) === String(params[0]));
    return { rows: user ? [dbUser(user)] : [], rowCount: user ? 1 : 0 };
  }

  if (text.includes('SELECT id') && text.includes('FROM carts') && text.includes('WHERE user_id = $1')) {
    const cart = carts.find((candidate) => candidate.user_id === Number(params[0]));
    return { rows: cart ? [cartRow(cart)] : [], rowCount: cart ? 1 : 0 };
  }

  if (text.includes('INSERT INTO carts')) {
    const existing = carts.find((cart) => cart.user_id === Number(params[0]));
    if (existing) {
      return { rows: [cartRow(existing)], rowCount: 1 };
    }

    const cart = { id: nextCartId++, user_id: Number(params[0]) };
    carts.push(cart);
    return { rows: [cartRow(cart)], rowCount: 1 };
  }

  if (text.includes('FROM product_variants pv') && text.includes('WHERE pv.id = $1') && !text.includes('FOR UPDATE')) {
    const variant = requireVariant(params[0]);
    if (!variant) {
      return { rows: [], rowCount: 0 };
    }
    const product = products.find((candidate) => candidate.id === variant.product_id);
    return {
      rows: [
        {
          id: variant.id,
          product_id: product.id,
          product_name: product.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          stock_quantity: variant.stock_quantity,
          unit_price: (Number(product.base_price) + Number(variant.price_delta)).toFixed(2)
        }
      ],
      rowCount: 1
    };
  }

  if (text.includes('SELECT id, quantity') && text.includes('FROM cart_items') && text.includes('cart_id = $1')) {
    const item = cartItems.find((candidate) => candidate.cart_id === Number(params[0]) && candidate.product_variant_id === Number(params[1]));
    return { rows: item ? [{ ...item }] : [], rowCount: item ? 1 : 0 };
  }

  if (text.includes('INSERT INTO cart_items')) {
    const item = {
      id: nextCartItemId++,
      cart_id: Number(params[0]),
      product_variant_id: Number(params[1]),
      quantity: Number(params[2])
    };
    cartItems.push(item);
    return { rows: [{ ...item }], rowCount: 1 };
  }

  if (text.includes('UPDATE cart_items') && text.includes('WHERE id = $2') && text.includes('cart_id = $3')) {
    const item = cartItems.find((candidate) => candidate.id === Number(params[1]) && candidate.cart_id === Number(params[2]));
    if (!item) {
      return { rows: [], rowCount: 0 };
    }
    item.quantity = Number(params[0]);
    return { rows: [{ ...item }], rowCount: 1 };
  }

  if (text.includes('DELETE FROM cart_items') && text.includes('WHERE id = $1') && text.includes('cart_id = $2')) {
    const index = cartItems.findIndex((candidate) => candidate.id === Number(params[0]) && candidate.cart_id === Number(params[1]));
    if (index === -1) {
      return { rows: [], rowCount: 0 };
    }
    const [deleted] = cartItems.splice(index, 1);
    return { rows: [{ ...deleted }], rowCount: 1 };
  }

  if (text.includes('UPDATE cart_items') && text.includes('WHERE id = $1') && text.includes('RETURNING')) {
    const item = cartItems.find((candidate) => candidate.id === Number(params[0]));
    if (!item) {
      return { rows: [], rowCount: 0 };
    }
    item.quantity = Number(params[1]);
    return { rows: [{ ...item }], rowCount: 1 };
  }

  if (text.includes('FROM carts c') && text.includes('LEFT JOIN cart_items')) {
    return { rows: fullCartRows(params[0]), rowCount: fullCartRows(params[0]).length };
  }

  if (text.includes('FROM carts c') && text.includes('JOIN cart_items ci') && text.includes('FOR UPDATE')) {
    return { rows: fullCartRows(params[0]), rowCount: fullCartRows(params[0]).length };
  }

  if (text.includes('FROM product_variants pv') && text.includes('FOR UPDATE')) {
    lockedVariants.push(...params[0].map(Number));
    const rows = params[0].map(requireVariant).filter(Boolean).map((variant) => ({ id: variant.id, stock_quantity: variant.stock_quantity }));
    return { rows, rowCount: rows.length };
  }

  if (text.includes('INSERT INTO orders')) {
    const [
      userId,
      customerEmail,
      customerName,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      subtotal,
      grandTotal
    ] = params;
    const order = {
      id: nextOrderId++,
      user_id: Number(userId),
      customer_email: customerEmail,
      customer_name: customerName,
      shipping_address_line1: line1,
      shipping_address_line2: line2,
      shipping_city: city,
      shipping_state: state,
      shipping_postal_code: postalCode,
      shipping_country: country,
      subtotal,
      shipping_total: '0.00',
      tax_total: '0.00',
      grand_total: grandTotal,
      order_status: 'pending',
      payment_method: 'cod',
      payment_status: 'unpaid',
      created_at: '2026-09-05T00:00:00.000Z'
    };
    orders.push(order);
    return { rows: [{ ...order }], rowCount: 1 };
  }

  if (text.includes('INSERT INTO order_items')) {
    const [orderId, productId, variantId, productName, sku, size, color, unitPrice, quantity, lineTotal] = params;
    const item = {
      id: nextOrderItemId++,
      order_id: Number(orderId),
      product_id: Number(productId),
      product_variant_id: Number(variantId),
      product_name: productName,
      sku,
      size,
      color,
      unit_price: unitPrice,
      quantity: Number(quantity),
      line_total: lineTotal
    };
    orderItems.push(item);
    return { rows: [{ ...item }], rowCount: 1 };
  }

  if (text.includes('UPDATE product_variants') && text.includes('stock_quantity = stock_quantity - $1')) {
    const variant = requireVariant(params[1]);
    variant.stock_quantity -= Number(params[0]);
    return { rows: [{ id: variant.id, stock_quantity: variant.stock_quantity }], rowCount: 1 };
  }

  if (text.includes('DELETE FROM cart_items') && text.includes('WHERE cart_id = $1')) {
    const before = cartItems.length;
    cartItems = cartItems.filter((item) => item.cart_id !== Number(params[0]));
    return { rows: [], rowCount: before - cartItems.length };
  }

  if (text.includes('FROM orders') && text.includes('WHERE user_id = $1') && !text.includes('AND id = $2')) {
    const rows = orderRowsFor(params[0]);
    return { rows, rowCount: rows.length };
  }

  if (text.includes('FROM orders') && text.includes('WHERE user_id = $1') && text.includes('AND id = $2')) {
    const order = orders.find((candidate) => candidate.user_id === Number(params[0]) && candidate.id === Number(params[1]));
    return { rows: order ? [{ ...order }] : [], rowCount: order ? 1 : 0 };
  }

  if (text.includes('FROM order_items') && text.includes('WHERE order_id = $1')) {
    const rows = orderItemRows(params[0]);
    return { rows, rowCount: rows.length };
  }

  throw new Error(`Unexpected SQL in cart/orders test: ${text}`);
}

Module._load = function patchedLoad(requestPath, parent, isMain) {
  if (requestPath === '../../db/pool' || requestPath.endsWith('/db/pool')) {
    return { query: mockQuery, pool: { connect: async () => ({ query: mockQuery, release() {} }) } };
  }

  if (requestPath === '../../db/transactions' || requestPath.endsWith('/db/transactions')) {
    return { withTransaction: async (callback) => callback({ query: mockQuery }) };
  }

  return originalLoad.call(this, requestPath, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
});

test.beforeEach(() => {
  resetStore();
});

test('requires auth to view cart', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp()).get('/api/cart').expect(401);

  assert.deepEqual(response.body, { message: 'Authentication required', details: null });
});

test('adds a product variant to the customer cart', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/cart/items')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ variantId: 101, quantity: 2 })
    .expect(201);

  assert.deepEqual(response.body.cart.items, [
    {
      id: 1,
      variantId: 101,
      productId: 10,
      productName: 'Road Runner 1',
      sku: 'RR1-9-BLK',
      size: '9',
      color: 'black',
      quantity: 2,
      stockQuantity: 5,
      unitPrice: 89.99,
      lineTotal: 179.98
    }
  ]);
  assert.equal(response.body.cart.subtotal, 179.98);
});

test('rejects cart quantity above stock with 409 JSON', async () => {
  const { createApp } = require('../src/app');

  const response = await request(createApp())
    .post('/api/cart/items')
    .set('Authorization', `Bearer ${tokenFor(1)}`)
    .send({ variantId: 101, quantity: 6 })
    .expect(409);

  assert.equal(response.headers['content-type'].startsWith('application/json'), true);
  assert.deepEqual(response.body, { message: 'Requested quantity exceeds stock', details: null });
});

test('updates and removes cart items', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(1);
  const addResponse = await request(createApp())
    .post('/api/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ variantId: 101, quantity: 2 })
    .expect(201);

  const itemId = addResponse.body.cart.items[0].id;
  const updateResponse = await request(createApp())
    .patch(`/api/cart/items/${itemId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ quantity: 3 })
    .expect(200);

  assert.equal(updateResponse.body.cart.items[0].quantity, 3);
  assert.equal(updateResponse.body.cart.subtotal, 269.97);

  const removeResponse = await request(createApp())
    .delete(`/api/cart/items/${itemId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.deepEqual(removeResponse.body.cart.items, []);
  assert.equal(removeResponse.body.cart.subtotal, 0);
});

test('creates a COD order from cart and clears cart', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(1);
  await request(createApp())
    .post('/api/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ variantId: 101, quantity: 2 })
    .expect(201);

  const response = await request(createApp())
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      receiverName: 'Jordan Miles',
      phone: '555-0100',
      shippingAddress: {
        line1: '1 Main St',
        line2: 'Apt 2',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US'
      },
      note: 'Leave at door'
    })
    .expect(201);

  assert.equal(response.body.order.paymentMethod, 'cod');
  assert.equal(response.body.order.paymentStatus, 'unpaid');
  assert.equal(response.body.order.orderStatus, 'pending');
  assert.equal(response.body.order.grandTotal, 179.98);
  assert.equal(response.body.order.items[0].sku, 'RR1-9-BLK');
  assert.deepEqual(fullCartRows(1), []);
});

test('decrements stock when order is created', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(1);
  await request(createApp())
    .post('/api/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ variantId: 101, quantity: 2 })
    .expect(201);

  await request(createApp())
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      receiverName: 'Jordan Miles',
      phone: '555-0100',
      shippingAddress: {
        line1: '1 Main St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US'
      }
    })
    .expect(201);

  assert.deepEqual(lockedVariants, [101]);
  assert.equal(requireVariant(101).stock_quantity, 3);
});

test('lists only the authenticated customer orders', async () => {
  const { createApp } = require('../src/app');
  const token = tokenFor(1);
  await request(createApp())
    .post('/api/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ variantId: 101, quantity: 1 })
    .expect(201);
  const createResponse = await request(createApp())
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      receiverName: 'Jordan Miles',
      phone: '555-0100',
      shippingAddress: {
        line1: '1 Main St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US'
      }
    })
    .expect(201);

  const listResponse = await request(createApp())
    .get('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.deepEqual(listResponse.body.orders.map((order) => order.id), [createResponse.body.order.id]);

  await request(createApp())
    .get('/api/orders/900')
    .set('Authorization', `Bearer ${token}`)
    .expect(404);
});
