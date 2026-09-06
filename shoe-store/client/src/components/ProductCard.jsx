import { Heart, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCart } from '../cart/CartContext.jsx';
import { categoryLabel, formatMoney, genderLabel } from '../utils/formatters.js';

export default function ProductCard({ product, compact = false }) {
  const { token, isAdmin } = useAuth();
  const { addItem } = useCart();
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [toast, setToast] = useState('');
  const canAdd = Boolean(token && !isAdmin && product.defaultVariantId && product.defaultVariantStock > 0);
  const badge = product.featured ? 'Bán chạy' : Number(product.totalStock || 0) > 0 ? 'Mới' : 'Hết hàng';

  async function handleAddToCart() {
    if (!canAdd) {
      setToast(token ? 'Vui lòng chọn size trong trang chi tiết.' : 'Đăng nhập để thêm sản phẩm.');
      return;
    }

    try {
      await addItem(product.defaultVariantId, 1);
      setToast('Đã thêm vào giỏ hàng.');
    } catch (error) {
      setToast(error.message);
    }
  }

  return (
    <article className={`product-card${compact ? ' product-card--compact' : ''}`}>
      <div className="product-card__media">
        <Link to={`/products/${product.slug}`} className="product-card__image-link" aria-label={`Xem ${product.name}`}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} />
          ) : (
            <div className="product-card__image-fallback">Solely</div>
          )}
        </Link>
        <span className="product-badge product-badge--themed">{badge}</span>
        <button
          type="button"
          className={`icon-button product-card__wishlist${isWishlisted ? ' is-active' : ''}`}
          aria-label={isWishlisted ? `Bỏ yêu thích ${product.name}` : `Yêu thích ${product.name}`}
          aria-pressed={isWishlisted}
          onClick={() => setIsWishlisted((current) => !current)}
        >
          <Heart size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{categoryLabel(product.category)}</span>
          <span>{genderLabel(product.gender)}</span>
        </div>
        <h2>
          <Link to={`/products/${product.slug}`}>{product.name}</Link>
        </h2>
        {product.description ? <p className="product-card__description">{product.description}</p> : null}
        <p className="product-card__price">{formatMoney(product.price)}</p>
        <p className="product-card__sizes">Size: {(product.availableSizes || []).join(', ') || 'Tạm hết'}</p>
        <button type="button" className="product-card__add" onClick={handleAddToCart}>
          <ShoppingBag size={17} aria-hidden="true" />
          Thêm vào giỏ hàng
        </button>
        {toast ? (
          <p className="toast-inline" role="status" aria-label="Thông báo giỏ hàng">
            {toast}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export { formatMoney };
