import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useCart } from '../cart/CartContext.jsx';
import { formatMoney } from '../components/ProductCard.jsx';
import { colorLabel } from '../utils/formatters.js';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
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

  const selectedVariant = useMemo(
    () => product?.variants?.find((variant) => String(variant.id) === selectedVariantId),
    [product, selectedVariantId]
  );
  const selectedPrice = Number(product?.price || 0) + Number(selectedVariant?.priceDelta || 0);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedVariant) {
      return;
    }
    setError('');
    setMessage('');

    try {
      await addItem(selectedVariant.id, Number(quantity));
      setMessage('Đã thêm vào túi hàng.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === 'loading') {
    return <p className="muted">Đang tải sản phẩm...</p>;
  }

  if (status === 'error') {
    return <p className="form-error">{error}</p>;
  }

  return (
    <section className="product-detail" aria-labelledby="product-title">
      <div className="gallery">
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

      <div className="detail-panel">
        <Link className="text-link" to="/products">
          Quay lại sản phẩm
        </Link>
        <p className="eyebrow">{product.brand}</p>
        <h1 id="product-title">{product.name}</h1>
        <p className="detail-price">{formatMoney(selectedPrice)}</p>
        <p>{product.description}</p>

        <form className="purchase-form" onSubmit={handleSubmit}>
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
                    aria-label={`Size ${variant.size}, màu ${colorLabel(variant.color)}, ${formatMoney(Number(product.price) + Number(variant.priceDelta || 0))}`}
                  />
                  <span>{variant.size}</span>
                  <span>{colorLabel(variant.color)}</span>
                  <span>{formatMoney(Number(product.price) + Number(variant.priceDelta || 0))}</span>
                  <small>Còn {variant.stockQuantity}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Số lượng
            <input
              type="number"
              min="1"
              max={selectedVariant?.stockQuantity || 1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          {message ? (
            <p className="success-message" role="status" aria-label="Thông báo giỏ hàng">
              {message}
            </p>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={!selectedVariant}>
            Thêm vào túi hàng
          </button>
        </form>
      </div>
    </section>
  );
}
