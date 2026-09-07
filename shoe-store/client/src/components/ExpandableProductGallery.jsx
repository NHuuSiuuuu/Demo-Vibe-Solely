import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function ExpandableProductGallery({ products = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => {
    if (selectedIndex === null) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setSelectedIndex(null);
      } else if (event.key === 'ArrowRight' && products.length > 1) {
        setSelectedIndex((current) => (current + 1) % products.length);
      } else if (event.key === 'ArrowLeft' && products.length > 1) {
        setSelectedIndex((current) => (current - 1 + products.length) % products.length);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [products.length, selectedIndex]);

  if (products.length === 0) {
    return <p className="product-gallery__empty">Chưa có sản phẩm bán chạy.</p>;
  }

  const selectedProduct = selectedIndex === null ? null : products[selectedIndex];

  return (
    <div className="product-gallery" role="region" aria-label="Gallery sản phẩm bán chạy">
      <div className="product-gallery__track">
        {products.map((product, index) => (
          <button
            className={`product-gallery__item${hoveredIndex === index ? ' is-hovered' : ''}`}
            key={product.id}
            type="button"
            style={{ flex: hoveredIndex === null ? 1 : hoveredIndex === index ? 2 : 0.5 }}
            aria-label={`Mở ảnh ${product.name}`}
            onClick={() => setSelectedIndex(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>Solely</span>}
            <span className="product-gallery__shade" aria-hidden="true" />
            <span className="product-gallery__caption">
              <small>{product.brand || 'Solely'}</small>
              <strong>{product.name}</strong>
            </span>
          </button>
        ))}
      </div>

      {selectedProduct ? (
        <div
          className="product-gallery__modal"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh sản phẩm"
          onClick={() => setSelectedIndex(null)}
        >
          <button className="product-gallery__close" type="button" aria-label="Đóng ảnh" onClick={() => setSelectedIndex(null)}>
            <X size={28} aria-hidden="true" />
          </button>
          {products.length > 1 ? (
            <button
              className="product-gallery__nav product-gallery__nav--previous"
              type="button"
              aria-label="Ảnh trước"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedIndex((current) => (current - 1 + products.length) % products.length);
              }}
            >
              <ChevronLeft size={36} aria-hidden="true" />
            </button>
          ) : null}
          <div className="product-gallery__modal-content" onClick={(event) => event.stopPropagation()}>
            {selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} /> : <span>Solely</span>}
            <div className="product-gallery__modal-info">
              <p id="product-gallery-modal-title">{selectedProduct.name}</p>
              <Link to={`/products/${selectedProduct.slug}`} onClick={() => setSelectedIndex(null)}>
                Xem sản phẩm
              </Link>
              <small>{selectedIndex + 1} / {products.length}</small>
            </div>
          </div>
          {products.length > 1 ? (
            <button
              className="product-gallery__nav product-gallery__nav--next"
              type="button"
              aria-label="Ảnh tiếp theo"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedIndex((current) => (current + 1) % products.length);
              }}
            >
              <ChevronRight size={36} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
