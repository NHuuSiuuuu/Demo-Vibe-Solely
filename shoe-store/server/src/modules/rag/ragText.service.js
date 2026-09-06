function chunkText({ title, content, maxLength = 1200 }) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const chunks = [];
  for (let offset = 0; offset < clean.length; offset += maxLength) {
    chunks.push({
      chunkIndex: chunks.length,
      title,
      content: clean.slice(offset, offset + maxLength).trim()
    });
  }

  return chunks;
}

function buildProductKnowledgeText(product) {
  const sizes = product.availableSizes?.join(', ') || 'Chưa có size còn hàng';
  const colors = product.availableColors?.join(', ') || 'Chưa có màu còn hàng';
  return [
    `Sản phẩm: ${product.name}`,
    `Slug: ${product.slug}`,
    `Thương hiệu: ${product.brand}`,
    `Danh mục: ${product.category}`,
    `Giới tính: ${product.gender}`,
    `Giá: ${Number(product.price).toLocaleString('vi-VN')} ₫`,
    `Mô tả: ${product.description}`,
    `Size còn hàng: ${sizes}`,
    `Màu còn hàng: ${colors}`,
    `Tồn kho: ${Number(product.totalStock || 0)}`
  ].join('\n');
}

module.exports = { chunkText, buildProductKnowledgeText };
