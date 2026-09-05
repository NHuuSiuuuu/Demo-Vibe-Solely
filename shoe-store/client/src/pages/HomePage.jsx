import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';

export default function HomePage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/api/products?sort=newest')
      .then((data) => {
        if (!cancelled) {
          setProducts((data.products || []).slice(0, 4));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="shop-page" aria-labelledby="home-title">
      <div className="commerce-hero">
        <div>
          <h1 id="home-title">Shoe Store</h1>
          <p>Find in-stock shoes, choose the exact size and color, and place a COD order.</p>
        </div>
        <Link className="button-link" to="/products">
          Shop products
        </Link>
      </div>
      <div className="section-heading">
        <h2>Newest arrivals</h2>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
