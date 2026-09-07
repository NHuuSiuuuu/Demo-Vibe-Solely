const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transactions');
const { mapOrder } = require('../orders/orders.service');
const { normalizeDiscountPercent } = require('../products/pricing');
const { HttpError } = require('../../utils/httpError');
const { env } = require('../../config/env');
const crypto = require('node:crypto');

const PRODUCT_STATUSES = new Set(['active', 'hidden']);
const CATEGORY_STATUSES = new Set(['active', 'hidden']);
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

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'san-pham';
}

function normalizeMoney(value, message) {
  if (value === null || value === undefined || Array.isArray(value) || typeof value === 'object' || typeof value === 'boolean') {
    throw new HttpError(400, message);
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new HttpError(400, message);
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new HttpError(400, message);
  }
  return amount.toFixed(2);
}

function normalizeStock(value) {
  if (value === null || value === undefined || Array.isArray(value) || typeof value === 'object' || typeof value === 'boolean') {
    throw new HttpError(400, 'Stock quantity must be nonnegative');
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new HttpError(400, 'Stock quantity must be nonnegative');
  }

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

function mapCategory(row) {
  return { id: Number(row.id), name: row.name, slug: row.slug, status: row.status };
}

function mapImage(row) {
  return { id: Number(row.id), imageUrl: row.image_url, altText: row.alt_text, sortOrder: Number(row.sort_order), publicId: row.cloudinary_public_id || null };
}

function mapVariant(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    sku: row.sku,
    size: row.size,
    color: row.color,
    stockQuantity: Number(row.stock_quantity),
    discountPercent: toNumber(row.discount_percent)
  };
}

function attachInventory(products, variants) {
  const variantsByProductId = new Map();

  for (const variant of variants) {
    const list = variantsByProductId.get(variant.productId) || [];
    list.push(variant);
    variantsByProductId.set(variant.productId, list);
  }

  return products.map((product) => {
    const productVariants = variantsByProductId.get(product.id) || [];
    return {
      ...product,
      totalStock: productVariants.reduce((sum, variant) => sum + Number(variant.stockQuantity || 0), 0),
      variants: productVariants
    };
  });
}

async function getVariantsForProductIds(productIds) {
  if (productIds.length === 0) {
    return [];
  }

  const result = await query(
    `
      SELECT *
      FROM product_variants
      WHERE product_id = ANY($1::int[])
      ORDER BY product_id ASC, id ASC
    `,
    [productIds]
  );

  return result.rows.map(mapVariant);
}

function pushUpdate(updates, params, column, value) {
  params.push(value);
  updates.push(`${column} = $${params.length}`);
}

function prepareProductInput(input, requireAll) {
  const output = {};

  if (Object.prototype.hasOwnProperty.call(input, 'slug') && input.slug) {
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
  if (Object.prototype.hasOwnProperty.call(input, 'priceDelta')) {
    throw new HttpError(400, 'priceDelta is not supported; use discountPercent');
  }

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
  if (Object.prototype.hasOwnProperty.call(input, 'discountPercent')) {
    output.discountPercent = normalizeDiscountPercent(input.discountPercent);
  } else if (requireAll) {
    output.discountPercent = normalizeDiscountPercent(0);
  }

  return output;
}

async function markProductChunksHidden(productId) {
  try {
    await query(
      `
        UPDATE rag_chunks
        SET status = 'hidden', updated_at = NOW()
        WHERE source_type = 'product' AND source_id = $1
      `,
      [productId]
    );
  } catch (_error) {
    // RAG bookkeeping must not block admin product saves.
  }
}

async function reindexProductBestEffort(productId) {
  try {
    const { reindexProduct } = require('../rag/ragIndex.service');
    await reindexProduct(productId);
  } catch (_error) {
    try {
      await query(
        `UPDATE rag_chunks SET status = 'needs_reindex', updated_at = NOW() WHERE source_type = 'product' AND source_id = $1`,
        [productId]
      );
    } catch (_fallbackError) {
      // RAG bookkeeping must not block admin product saves.
    }
  }
}

async function getProductStatus(productId) {
  const result = await query(
    `
      SELECT status
      FROM products
      WHERE id = $1
    `,
    [productId]
  );

  return result.rows[0] ? result.rows[0].status : null;
}

async function syncProductRag(productId, status) {
  const productStatus = status || (await getProductStatus(productId));
  if (productStatus === 'hidden') {
    await markProductChunksHidden(productId);
    return;
  }

  await reindexProductBestEffort(productId);
}

async function getDashboard() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*)::INT FROM products) AS products_count,
      (SELECT COUNT(*)::INT FROM product_variants) AS variants_count,
      (SELECT COUNT(*)::INT FROM orders) AS orders_count,
      (SELECT COUNT(*)::INT FROM orders WHERE order_status = 'pending') AS pending_orders_count,
      COALESCE((SELECT SUM(grand_total) FROM orders WHERE payment_status = 'paid'), 0) AS completed_revenue
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

  const products = result.rows.map(mapProduct);
  const variants = await getVariantsForProductIds(products.map((product) => product.id));
  return attachInventory(products, variants);
}

async function getProduct(id) {
  const result = await query(
    `
      SELECT *
      FROM products p
      WHERE p.id = $1
    `,
    [id]
  );

  const product = result.rows[0];
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }

  const variants = await getVariantsForProductIds([Number(id)]);
  const imagesResult = await query(
    'SELECT id, image_url, alt_text, sort_order, cloudinary_public_id FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC',
    [id]
  );
  return { ...attachInventory([mapProduct(product)], variants)[0], images: imagesResult.rows.map(mapImage) };
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
      slugify(product.name),
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

  const createdProduct = mapProduct(result.rows[0]);
  await syncProductRag(createdProduct.id, createdProduct.status);
  return createdProduct;
}

async function updateProduct(id, input) {
  const product = prepareProductInput(input, false);
  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(product, 'slug')) pushUpdate(updates, params, 'slug', product.slug);
  if (Object.prototype.hasOwnProperty.call(product, 'name') && !Object.prototype.hasOwnProperty.call(input, 'slug')) {
    pushUpdate(updates, params, 'slug', slugify(product.name));
  }
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

  const updatedProduct = mapProduct(result.rows[0]);
  await syncProductRag(updatedProduct.id, updatedProduct.status);
  return updatedProduct;
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
        discount_percent
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [productId, variant.sku, variant.size, variant.color, variant.stockQuantity, variant.discountPercent]
  );

  const createdVariant = mapVariant(result.rows[0]);
  await syncProductRag(createdVariant.productId);
  return createdVariant;
}

async function updateVariant(id, input) {
  const variant = prepareVariantInput(input, false);
  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(variant, 'sku')) pushUpdate(updates, params, 'sku', variant.sku);
  if (Object.prototype.hasOwnProperty.call(variant, 'size')) pushUpdate(updates, params, 'size', variant.size);
  if (Object.prototype.hasOwnProperty.call(variant, 'color')) pushUpdate(updates, params, 'color', variant.color);
  if (Object.prototype.hasOwnProperty.call(variant, 'stockQuantity')) pushUpdate(updates, params, 'stock_quantity', variant.stockQuantity);
  if (Object.prototype.hasOwnProperty.call(variant, 'discountPercent')) {
    pushUpdate(updates, params, 'discount_percent', variant.discountPercent);
    updates.push('legacy_pricing_active = FALSE');
  }

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

  const updatedVariant = mapVariant(result.rows[0]);
  await syncProductRag(updatedVariant.productId);
  return updatedVariant;
}

async function listOrders() {
  const result = await query(`
    SELECT *
    FROM orders
    ORDER BY created_at DESC, id DESC
  `);

  return result.rows.map((row) => mapOrder(row));
}

async function getOrderItems(orderId, client = { query }, { lock = false } = {}) {
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
      ${lock ? 'FOR UPDATE' : ''}
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

    if (currentOrder.payment_method === 'vnpay') {
      if (['shipping', 'completed'].includes(status) && currentOrder.payment_status !== 'paid') {
        throw new HttpError(409, 'VNPay orders must be paid before fulfillment');
      }
      if (status === 'cancelled' && currentOrder.payment_status === 'pending') {
        throw new HttpError(409, 'Pending VNPay payment must be reconciled before cancellation');
      }
    }

    if (
      status === 'cancelled' &&
      currentOrder.payment_method === 'vnpay' &&
      currentOrder.payment_status === 'paid'
    ) {
      throw new HttpError(409, 'Paid VNPay orders require a refund before cancellation');
    }

    const items = await getOrderItems(id, client, { lock: status === 'cancelled' });

    if (status === 'cancelled') {
      for (const item of items) {
        if (item.product_variant_id === null || item.product_variant_id === undefined) {
          continue;
        }

        const stockResult = await client.query(
          `
            UPDATE product_variants
            SET stock_quantity = stock_quantity + $1
            WHERE id = $2
            RETURNING id, stock_quantity
          `,
          [Number(item.quantity), item.product_variant_id]
        );

        if (stockResult.rowCount !== 1) {
          throw new HttpError(409, 'Unable to restore product variant stock');
        }
      }
    }

    const updateResult = await client.query(
      `
        UPDATE orders
        SET order_status = $1,
            payment_status = CASE WHEN $3::order_status = 'completed' AND payment_method = 'cod' THEN 'paid'
              ELSE payment_status
            END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [status, id, status]
    );

    return mapOrder(updateResult.rows[0], items);
  });
}

async function listCategories() {
  const result = await query(`SELECT id, name, slug, status FROM categories ORDER BY name ASC, id ASC`);
  return result.rows.map(mapCategory);
}

async function createCategory(input) {
  const name = requireText(input.name, 'Category name is required');
  const slug = slugify(name);
  const result = await query(
    `INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id, name, slug, status`,
    [name, slug]
  );
  return mapCategory(result.rows[0]);
}

async function updateCategory(id, input) {
  const updates = [];
  const params = [];
  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    const name = requireText(input.name, 'Category name is required');
    pushUpdate(updates, params, 'name', name);
    pushUpdate(updates, params, 'slug', slugify(name));
  }
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    const status = requireText(input.status, 'Category status is required');
    if (!CATEGORY_STATUSES.has(status)) throw new HttpError(400, 'Category status is invalid');
    pushUpdate(updates, params, 'status', status);
  }
  if (!updates.length) throw new HttpError(400, 'No category updates provided');
  params.push(id);
  const result = await query(
    `UPDATE categories SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, name, slug, status`,
    params
  );
  if (!result.rows.length) throw new HttpError(404, 'Category not found');
  return mapCategory(result.rows[0]);
}

async function deleteCategory(id) {
  const result = await query(`UPDATE categories SET status = 'hidden', updated_at = NOW() WHERE id = $1 RETURNING id`, [id]);
  if (!result.rows.length) throw new HttpError(404, 'Category not found');
}

function getCloudinarySignature() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, 'Cloudinary is not configured');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'solely/products';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`).digest('hex');
  return { timestamp, folder, signature, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME };
}

async function createProductImage(productId, input) {
  const imageUrl = requireText(input.imageUrl, 'Image URL is required');
  const altText = requireText(input.altText || 'Ảnh sản phẩm Solely', 'Alt text is required');
  const result = await query(
    `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, cloudinary_public_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, image_url, alt_text, sort_order, cloudinary_public_id`,
    [productId, imageUrl, altText, Number(input.sortOrder || 0), cleanText(input.publicId)]
  );
  const image = mapImage(result.rows[0]);
  Promise.resolve()
    .then(() => require('../imageSearch/imageSearch.service').indexProductImage({
      productId: Number(productId),
      productImageId: image.id,
      imageUrl: image.imageUrl
    }))
    .catch(() => {
      console.warn('[image-search] product image indexing failed', {
        productId: Number(productId),
        productImageId: image.id
      });
    });
  return image;
}

module.exports = {
  getDashboard,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  createVariant,
  updateVariant,
  listOrders,
  getOrder,
  updateOrderStatus,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCloudinarySignature,
  createProductImage
};
