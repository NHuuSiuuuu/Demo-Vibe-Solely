import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useCart } from '../cart/CartContext.jsx';
import { formatMoney } from '../components/ProductCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { categoryLabel, colorLabel } from '../utils/formatters.js';

const reviews = [
  {
    name: 'Minh Anh',
    date: '02.09.2026',
    text: 'Giày nhẹ, đi cả ngày không bị mỏi chân. Màu ngoài đời dễ phối hơn ảnh.',
    initials: 'MA'
  },
  {
    name: 'Hoàng Nam',
    date: '29.08.2026',
    text: 'Form gọn, đế êm và giao hàng nhanh. Mình sẽ mua thêm màu trắng.',
    initials: 'HN'
  }
];

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedIndex, setRelatedIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    apiClient
      .get(`/api/products/${slug}`)
      .then((data) => {
        if (!cancelled) {
          const loaded = data.product;
          setProduct(loaded);
          setSelectedImage(loaded.images?.[0]?.imageUrl || '');
          setSelectedVariantId(String(loaded.variants?.find((variant) => variant.stockQuantity > 0)?.id || ''));
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/api/products?sort=newest')
      .then((data) => {
        if (!cancelled) {
          setRelatedProducts((data.products || []).filter((item) => item.slug !== slug));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRelatedProducts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const selectedVariant = useMemo(
    () => product?.variants?.find((variant) => String(variant.id) === selectedVariantId),
    [product, selectedVariantId]
  );
  const selectedPrice = Number(selectedVariant?.unitPrice ?? product?.price ?? 0);
  const selectedDiscountPercent = Number(selectedVariant?.discountPercent || 0);
  const hasSelectedDiscount = selectedDiscountPercent > 0 && selectedPrice < Number(product?.price || 0);
  const maxQuantity = selectedVariant?.stockQuantity || 1;
  const visibleRelatedProducts = relatedProducts.length ? relatedProducts.slice(relatedIndex, relatedIndex + 4) : [];

  function updateQuantity(nextQuantity) {
    const numericQuantity = Number(nextQuantity || 1);
    setQuantity(Math.min(Math.max(numericQuantity, 1), maxQuantity));
  }

  async function addSelectedVariant() {
    if (!selectedVariant) {
      return;
    }
    setError('');
    setMessage('');

    try {
      await addItem(selectedVariant.id, Number(quantity));
      setMessage('Đã thêm vào giỏ hàng.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await addSelectedVariant();
  }

  async function handleBuyNow() {
    await addSelectedVariant();
  }

  function showPreviousRelated() {
    setRelatedIndex((current) => Math.max(current - 1, 0));
  }

  function showNextRelated() {
    setRelatedIndex((current) => Math.min(current + 1, Math.max(relatedProducts.length - 4, 0)));
  }

  if (status === 'loading') {
    return <p className="muted">Đang tải sản phẩm...</p>;
  }

  if (status === 'error') {
    return <p className="form-error">{error}</p>;
  }

  return (
    <section className="product-detail-page" aria-labelledby="product-title">
      <nav className="breadcrumb-nav" aria-label="Đường dẫn sản phẩm">
        <Link to="/products">Sản phẩm</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/products?category=${product.category}`}>{categoryLabel(product.category)}</Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="gallery product-detail__gallery">
          <div className="gallery__main">
            {selectedImage ? <img src={selectedImage} alt={product.name} /> : <div className="product-card__image-fallback">Giày</div>}
          </div>
          <div className="gallery__thumbs">
            {(product.images || []).map((image) => (
              <button
                type="button"
                className="thumb-button"
                key={image.id}
                onClick={() => setSelectedImage(image.imageUrl)}
                aria-label={image.altText || product.name}
              >
                <img src={image.imageUrl} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="detail-panel product-info-panel">
          <p className="eyebrow">{categoryLabel(product.category)}</p>
          <h1 id="product-title">{product.name}</h1>
          <div className="rating-row" aria-label="Đánh giá 5 sao">
            <span>
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} size={16} fill="currentColor" aria-hidden="true" />
              ))}
            </span>
            <a href="#reviews">(24 đánh giá)</a>
          </div>
          <p className="detail-description">{product.description}</p>

          <form className="purchase-form editorial-purchase-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend>Chọn phiên bản</legend>
              <div className="variant-grid">
                {(product.variants || []).map((variant) => (
                  <label key={variant.id} className="variant-option">
                    <input
                      type="radio"
                      name="variantId"
                      value={variant.id}
                      checked={selectedVariantId === String(variant.id)}
                      onChange={(event) => setSelectedVariantId(event.target.value)}
                      disabled={variant.stockQuantity <= 0}
                      aria-label={`Size ${variant.size}, màu ${colorLabel(variant.color)}, ${formatMoney(variant.unitPrice)}`}
                    />
                    <span>{variant.size}</span>
                    <span>{colorLabel(variant.color)}</span>
                    <span>{formatMoney(variant.unitPrice)}</span>
                    <small>Còn {variant.stockQuantity}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="purchase-metrics">
              <label>
                <span>Số lượng</span>
                <div className="quantity-stepper">
                  <button type="button" aria-label="Giảm số lượng" onClick={() => updateQuantity(Number(quantity) - 1)}>
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <input
                    aria-label="Số lượng"
                    type="number"
                    min="1"
                    max={maxQuantity}
                    value={quantity}
                    onChange={(event) => updateQuantity(event.target.value)}
                  />
                  <button type="button" aria-label="Tăng số lượng" onClick={() => updateQuantity(Number(quantity) + 1)}>
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </label>
              <div className="price-metric">
                <span>{hasSelectedDiscount ? 'Giá sau giảm' : 'Giá'}</span>
                <strong>{formatMoney(selectedPrice)}</strong>
                {hasSelectedDiscount ? (
                  <>
                    <small>Giá gốc: {formatMoney(product.price)}</small>
                    <small>Giảm {selectedDiscountPercent}%</small>
                  </>
                ) : null}
              </div>
            </div>

            {message ? (
              <p className="success-message" role="status" aria-label="Thông báo giỏ hàng">
                {message}
              </p>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="detail-actions">
              <button type="submit" className="button-secondary" disabled={!selectedVariant}>
                Thêm vào giỏ hàng
              </button>
              <button type="button" onClick={handleBuyNow} disabled={!selectedVariant}>
                Mua ngay
              </button>
            </div>
          </form>
        </div>
      </div>

      <section className="reviews-section" id="reviews" aria-labelledby="reviews-title">
        <div className="reviews-header">
          <h2 id="reviews-title">Đánh giá:</h2>
          <a href="mailto:support@solely.local">+ Gửi phản hồi</a>
        </div>
        <div className="review-list">
          {reviews.map((review) => (
            <article className="review-row" key={review.name}>
              <div className="review-avatar" aria-hidden="true">
                {review.initials}
              </div>
              <div>
                <div className="review-meta">
                  <strong>{review.name}</strong>
                  <time>{review.date}</time>
                </div>
                <div className="rating-row rating-row--compact" aria-label="Đánh giá 5 sao">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} size={14} fill="currentColor" aria-hidden="true" />
                  ))}
                </div>
                <p>{review.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="related-section" aria-labelledby="related-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GỢI Ý</p>
            <h2 id="related-title">Có thể bạn cũng thích</h2>
          </div>
          <div className="related-controls" aria-label="Điều khiển sản phẩm liên quan">
            <button type="button" aria-label="Sản phẩm liên quan trước" onClick={showPreviousRelated} disabled={relatedIndex === 0}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Sản phẩm liên quan tiếp theo"
              onClick={showNextRelated}
              disabled={relatedIndex >= Math.max(relatedProducts.length - 4, 0)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="product-grid related-grid">
          {visibleRelatedProducts.map((item) => (
            <ProductCard key={item.id} product={item} compact />
          ))}
        </div>
      </section>
    </section>
  );
}
