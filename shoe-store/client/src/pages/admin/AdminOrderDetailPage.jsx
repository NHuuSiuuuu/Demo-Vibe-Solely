import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatMoney } from '../../components/ProductCard.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

const nextStatuses = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    apiClient
      .get(`/api/admin/orders/${id}`, { token })
      .then((data) => {
        if (!cancelled) {
          setOrder(data.order);
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
  }, [id, token]);

  async function updateStatus(nextStatus) {
    setMessage('');
    setError('');

    try {
      const data = await apiClient.patch(`/api/admin/orders/${id}/status`, { status: nextStatus }, { token });
      setOrder(data.order);
      setMessage('Order status updated.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === 'loading') {
    return <p className="muted">Loading order...</p>;
  }

  if (status === 'error') {
    return <p className="form-error">{error}</p>;
  }

  const availableStatuses = nextStatuses[order.orderStatus] || [];

  return (
    <section className="admin-page" aria-labelledby="admin-order-title">
      <div className="section-heading">
        <div>
          <Link className="text-link" to="/admin/orders">
            Back to orders
          </Link>
          <h1 id="admin-order-title">Order ORD-{order.id}</h1>
          <p>{order.customerEmail}</p>
        </div>
        <div className="admin-status-stack">
          <StatusBadge tone="info">{order.orderStatus}</StatusBadge>
          <StatusBadge>{order.paymentStatus}</StatusBadge>
        </div>
      </div>
      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="admin-actions">
        {availableStatuses.map((nextStatus) => (
          <button type="button" key={nextStatus} onClick={() => updateStatus(nextStatus)}>
            Mark {nextStatus}
          </button>
        ))}
      </div>

      <div className="detail-grid">
        <section className="content-panel" aria-labelledby="admin-customer-title">
          <h2 id="admin-customer-title">Customer</h2>
          <p>{order.customerName}</p>
          <p>{order.customerEmail}</p>
          <p>
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
          </p>
        </section>
        <section className="content-panel" aria-labelledby="admin-order-items-title">
          <h2 id="admin-order-items-title">Items</h2>
          {(order.items || []).map((item) => (
            <article className="summary-item" key={item.id}>
              <span>
                {item.productName} / {item.sku} / size {item.size} / {item.color} x {item.quantity}
              </span>
              <strong>{formatMoney(item.lineTotal)}</strong>
            </article>
          ))}
          <div className="summary-row">
            <span>Total</span>
            <strong>{formatMoney(order.grandTotal)}</strong>
          </div>
        </section>
      </div>
    </section>
  );
}
