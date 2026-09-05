const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transactions');
const { mapOrder } = require('../orders/orders.service');
const { HttpError } = require('../../utils/httpError');

const PRODUCT_STATUSES = new Set(['active', 'hidden']);
const ORDER_TRANSITIONS = {
  pending: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['shipping', 'cancelled']),
  shipping: new Set(['completed', 'cancelled']),
  completed: new Set(),
  cancelled: new Set()
};

function toNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function requireText(value, message) {
  const text = cleanText(value);
  if (!text) {
    throw new HttpError(400, message);
  }
  return text;
}

function normalizeMoney(value, message) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, message);
  }
  return amount.toFixed(2);
}

function normalizeStock(value) {
  const stock = Number(value);
  if (!Number.isInteger(stock) || stock < 0) {
    throw new HttpError(400, 'Stock quantity must be nonnegative');
  }
  return stock;
}

function normalizeStatus(value) {
  const status = requireText(value, 'Status is required');
  if (!PRODUCT_STATUSES.has(status)) {
    throw new HttpError(400, 'Status is invalid');
  }
  return status;
}

function mapProduct(row) {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    brand: row.brand,
    category: row.category,
    gender: row.gender,
    price: toNumber(row.base_price),
    status: row.status,
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapVariant(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    sku: row.sku,
    size: row.size,
    color: row.color,
    stockQuantity: Number(row.stock_quantity),
    priceDelta: toNumber(row.price_delta)
  };
}

function pushUpdate(updates, params, column, value) {
  params.push(value);
  updates.push(`${column} = $${params.length}`);
}

function prepareProductInput(input, requireAll) {
  const output = {};

  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'slug')) {
    output.slug = requireText(input.slug, 'Slug is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'name')) {
    output.name = requireText(input.name, 'Name is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'description')) {
    output.description = requireText(input.description, 'Description is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'brand')) {
    output.brand = requireText(input.brand, 'Brand is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'category')) {
    output.category = requireText(input.category, 'Category is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'gender')) {
    output.gender = requireText(input.gender, 'Gender is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'price')) {
    output.basePrice = normalizeMoney(input.price, 'Price must be nonnegative');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'status')) {
    output.status = normalizeStatus(input.status);
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'featured')) {
    output.featured = Boolean(input.featured);
  }

  return output;
}

function prepareVariantInput(input, requireAll) {
  const output = {};

  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'sku')) {
    output.sku = requireText(input.sku, 'SKU is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'size')) {
    output.size = requireText(input.size, 'Size is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'color')) {
    output.color = requireText(input.color, 'Color is required');
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'stockQuantity')) {
    output.stockQuantity = normalizeStock(input.stockQuantity);
  }
  if (requireAll || Object.prototype.hasOwnProperty.call(input, 'priceDelta')) {
    output.priceDelta = normalizeMoney(input.priceDelta || 0, 'Price delta must be nonnegative');
  }

  return output;
}

async function getDashboard() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*)::INT FROM products) AS products_count,
      (SELECT COUNT(*)::INT FROM product_variants) AS variants_count,
      (SELECT COUNT(*)::INT FROM orders) AS orders_count,
      (SELECT COUNT(*)::INT FROM orders WHERE order_status = 'pending') AS pending_orders_count,
      COALESCE((SELECT SUM(grand_total) FROM orders WHERE order_status = 'completed'), 0) AS completed_revenue
  `);

  const row = result.rows[0];
  return {
    productsCount: Number(row.products_count),
    variantsCount: Number(row.variants_count),
    ordersCount: Number(row.orders_count),
    pendingOrdersCount: Number(row.pending_orders_count),
    completedRevenue: Number(row.completed_revenue)
  };
}

async function listProducts() {
  const result = await query(`
    SELECT *
    FROM products p
    ORDER BY p.created_at DESC, p.id DESC
  `);

  return result.rows.map(mapProduct);
}

async function createProduct(input) {
  const product = prepareProductInput(input, true);
  const result = await query(
    `
      INSERT INTO products (
        slug,
        name,
        description,
        brand,
        category,
        gender,
        base_price,
        status,
        featured
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      product.slug,
      product.name,
      product.description,
      product.brand,
      product.category,
      product.gender,
      product.basePrice,
      product.status,
      product.featured
    ]
  );

  return mapProduct(result.rows[0]);
}

async function updateProduct(id, input) {
  const product = prepareProductInput(input, false);
  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(product, 'slug')) pushUpdate(updates, params, 'slug', product.slug);
  if (Object.prototype.hasOwnProperty.call(product, 'name')) pushUpdate(updates, params, 'name', product.name);
  if (Object.prototype.hasOwnProperty.call(product, 'description')) pushUpdate(updates, params, 'description', product.description);
  if (Object.prototype.hasOwnProperty.call(product, 'brand')) pushUpdate(updates, params, 'brand', product.brand);
  if (Object.prototype.hasOwnProperty.call(product, 'category')) pushUpdate(updates, params, 'category', product.category);
  if (Object.prototype.hasOwnProperty.call(product, 'gender')) pushUpdate(updates, params, 'gender', product.gender);
  if (Object.prototype.hasOwnProperty.call(product, 'basePrice')) pushUpdate(updates, params, 'base_price', product.basePrice);
  if (Object.prototype.hasOwnProperty.call(product, 'status')) pushUpdate(updates, params, 'status', product.status);
  if (Object.prototype.hasOwnProperty.call(product, 'featured')) pushUpdate(updates, params, 'featured', product.featured);

  if (updates.length === 0) {
    throw new HttpError(400, 'No product updates provided');
  }

  params.push(id);
  const result = await query(
    `
      UPDATE products
      SET ${updates.join(', ')},
          updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING *
    `,
    params
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, 'Product not found');
  }

  return mapProduct(result.rows[0]);
}

async function createVariant(productId, input) {
  const variant = prepareVariantInput(input, true);
  const productResult = await query(
    `
      SELECT id
      FROM products
      WHERE id = $1
    `,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new HttpError(404, 'Product not found');
  }

  const result = await query(
    `
      INSERT INTO product_variants (
        product_id,
        sku,
        size,
        color,
        stock_quantity,
        price_delta
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [productId, variant.sku, variant.size, variant.color, variant.stockQuantity, variant.priceDelta]
  );

  return mapVariant(result.rows[0]);
}

async function updateVariant(id, input) {
  const variant = prepareVariantInput(input, false);
  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(variant, 'sku')) pushUpdate(updates, params, 'sku', variant.sku);
  if (Object.prototype.hasOwnProperty.call(variant, 'size')) pushUpdate(updates, params, 'size', variant.size);
  if (Object.prototype.hasOwnProperty.call(variant, 'color')) pushUpdate(updates, params, 'color', variant.color);
  if (Object.prototype.hasOwnProperty.call(variant, 'stockQuantity')) pushUpdate(updates, params, 'stock_quantity', variant.stockQuantity);
  if (Object.prototype.hasOwnProperty.call(variant, 'priceDelta')) pushUpdate(updates, params, 'price_delta', variant.priceDelta);

  if (updates.length === 0) {
    throw new HttpError(400, 'No variant updates provided');
  }

  params.push(id);
  const result = await query(
    `
      UPDATE product_variants
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `,
    params
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, 'Variant not found');
  }

  return mapVariant(result.rows[0]);
}

async function listOrders() {
  const result = await query(`
    SELECT *
    FROM orders
    ORDER BY created_at DESC, id DESC
  `);

  return result.rows.map((row) => mapOrder(row));
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

async function getOrder(id) {
  const result = await query(
    `
      SELECT *
      FROM orders
      WHERE id = $1
    `,
    [id]
  );

  const order = result.rows[0];
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }

  const items = await getOrderItems(order.id);
  return mapOrder(order, items);
}

function assertOrderTransition(currentStatus, nextStatus) {
  if (!Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS, nextStatus)) {
    throw new HttpError(400, 'Invalid order status');
  }

  const allowed = ORDER_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(nextStatus)) {
    throw new HttpError(400, 'Invalid order status transition');
  }
}

async function updateOrderStatus(id, status) {
  return withTransaction(async (client) => {
    const orderResult = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    const currentOrder = orderResult.rows[0];
    if (!currentOrder) {
      throw new HttpError(404, 'Order not found');
    }

    assertOrderTransition(currentOrder.order_status, status);

    const updateResult = await client.query(
      `
        UPDATE orders
        SET order_status = $1,
            payment_status = CASE WHEN $1 = 'completed' THEN 'paid' ELSE payment_status END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [status, id]
    );
    const items = await getOrderItems(id, client);

    return mapOrder(updateResult.rows[0], items);
  });
}

module.exports = {
  getDashboard,
  listProducts,
  createProduct,
  updateProduct,
  createVariant,
  updateVariant,
  listOrders,
  getOrder,
  updateOrderStatus
};
