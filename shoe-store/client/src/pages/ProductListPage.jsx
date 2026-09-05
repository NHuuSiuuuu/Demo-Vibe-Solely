import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';

const initialFilters = {
  q: '',
  brand: '',
  gender: '',
  size: '',
  color: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest'
};

function buildProductQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `/api/products?${query}` : '/api/products';
}

export default function ProductListPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    apiClient
      .get(buildProductQuery(filters))
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products || []);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setProducts([]);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <section className="shop-page" aria-labelledby="products-title">
      <div className="section-heading">
        <div>
          <h1 id="products-title">Products</h1>
          <p>Browse active shoes by fit, style, and budget.</p>
        </div>
      </div>

      <form className="filter-bar">
        <label>
          Search products
          <input name="q" type="search" value={filters.q} onChange={updateFilter} />
        </label>
        <label>
          Brand
          <input name="brand" value={filters.brand} onChange={updateFilter} />
        </label>
        <label>
          Gender
          <select name="gender" value={filters.gender} onChange={updateFilter}>
            <option value="">Any</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>
        </label>
        <label>
          Size
          <input name="size" value={filters.size} onChange={updateFilter} />
        </label>
        <label>
          Color
          <input name="color" value={filters.color} onChange={updateFilter} />
        </label>
        <label>
          Min price
          <input name="minPrice" type="number" min="0" value={filters.minPrice} onChange={updateFilter} />
        </label>
        <label>
          Max price
          <input name="maxPrice" type="number" min="0" value={filters.maxPrice} onChange={updateFilter} />
        </label>
        <label>
          Sort
          <select name="sort" value={filters.sort} onChange={updateFilter}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name_asc">Name</option>
          </select>
        </label>
      </form>

      {status === 'error' ? <p className="form-error">{error}</p> : null}
      {status === 'loading' ? <p className="muted">Loading products...</p> : null}
      {status === 'ready' && products.length === 0 ? <p className="muted">No products match those filters.</p> : null}
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export { buildProductQuery };
