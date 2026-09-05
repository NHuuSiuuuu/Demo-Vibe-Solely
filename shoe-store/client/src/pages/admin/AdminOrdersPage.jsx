import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatMoney } from '../../components/ProductCard.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatDate, formatOrderCode } from '../OrdersPage.jsx';

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    apiClient
      .get('/api/admin/orders', { token })
      .then((data) => {
        if (!cancelled) {
          setOrders(data.orders || []);
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
    <section className="admin-page" aria-labelledby="admin-orders-title">
      <div className="section-heading">
        <div>
          <h1 id="admin-orders-title">Order management</h1>
          <p>Review customer, total, order status, payment status.</p>
        </div>
      </div>
      {status === 'loading' ? <p className="muted">Loading orders...</p> : null}
      {status === 'error' ? <p className="form-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table aria-label="Admin orders" className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Order status</th>
              <th>Payment status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{formatOrderCode(order)}</td>
                <td>{formatDate(order.createdAt)}</td>
                <td>
                  <strong>{order.customerName}</strong>
                  <span>{order.customerEmail}</span>
                </td>
                <td>{formatMoney(order.grandTotal)}</td>
                <td>
                  <StatusBadge tone="info">{order.orderStatus}</StatusBadge>
                </td>
                <td>
                  <StatusBadge>{order.paymentStatus}</StatusBadge>
                </td>
                <td>
                  <Link className="text-link" to={`/admin/orders/${order.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {status === 'ready' && orders.length === 0 ? <p className="muted">No orders found.</p> : null}
    </section>
  );
}
