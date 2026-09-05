import { Link } from 'react-router-dom';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function ProductCard({ product, compact = false }) {
  return (
    <article className={`product-card${compact ? ' product-card--compact' : ''}`}>
      <Link to={`/products/${product.slug}`} className="product-card__image-link" aria-label={`View ${product.name}`}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <div className="product-card__image-fallback">Shoe</div>
        )}
      </Link>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.brand}</span>
          <span>{product.gender}</span>
        </div>
        <h2>
          <Link to={`/products/${product.slug}`}>{product.name}</Link>
        </h2>
        <p className="product-card__price">{formatMoney(product.price)}</p>
        <p className="product-card__sizes">Sizes: {(product.availableSizes || []).join(', ') || 'Unavailable'}</p>
      </div>
    </article>
  );
}

export { formatMoney };
