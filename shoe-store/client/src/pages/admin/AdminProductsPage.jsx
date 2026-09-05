import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatMoney } from '../../components/ProductCard.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

function stockSummary(product) {
  if (product.totalStock !== undefined && product.totalStock !== null) {
    return `${product.totalStock} units`;
  }

  if (Array.isArray(product.variants)) {
    const total = product.variants.reduce((sum, variant) => sum + Number(variant.stockQuantity || 0), 0);
    return `${total} units`;
  }

  return 'Not reported';
}

export default function AdminProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    apiClient
      .get('/api/admin/products', { token })
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products || []);
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
  }, [token]);

  return (
    <section className="admin-page" aria-labelledby="admin-products-title">
      <div className="section-heading">
        <div>
          <h1 id="admin-products-title">Product management</h1>
          <p>Maintain catalog records and variant inventory.</p>
        </div>
        <Link className="button-link" to="/admin/products/new">
          New product
        </Link>
      </div>
      {status === 'loading' ? <p className="muted">Loading products...</p> : null}
      {status === 'error' ? <p className="form-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table aria-label="Admin products" className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Status</th>
              <th>Price</th>
              <th>Stock summary</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                  <span>{product.slug}</span>
                </td>
                <td>{product.brand}</td>
                <td>
                  <StatusBadge tone={product.status === 'active' ? 'info' : 'neutral'}>{product.status}</StatusBadge>
                </td>
                <td>{formatMoney(product.price)}</td>
                <td>{stockSummary(product)}</td>
                <td>
                  <Link className="text-link" to={`/admin/products/${product.id}/edit`}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {status === 'ready' && products.length === 0 ? <p className="muted">No products found.</p> : null}
    </section>
  );
}

export { stockSummary };
