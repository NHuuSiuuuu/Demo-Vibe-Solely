import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';
import { formatMoney } from '../components/ProductCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from '../utils/formatters.js';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '';
}

function formatOrderCode(order) {
  return order.orderCode || `ORD-${order.id}`;
}

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setOrders([]);
      return undefined;
    }

    let cancelled = false;
    apiClient
      .get('/api/orders', { token })
      .then((data) => {
        if (!cancelled) {
          setOrders(data.orders || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <AuthPrompt message="Đăng nhập hoặc đăng ký để xem lịch sử đơn hàng." />;
  }

  return (
    <section className="shop-page" aria-labelledby="orders-title">
      <h1 id="orders-title">Đơn hàng</h1>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="order-list">
        {orders.map((order) => (
          <Link className="order-row" to={`/orders/${order.id}`} key={order.id}>
            <span>{formatOrderCode(order)}</span>
            <span>{formatDate(order.createdAt)}</span>
            <strong>{formatMoney(order.grandTotal)}</strong>
            <StatusBadge>{paymentMethodLabel(order.paymentMethod)}</StatusBadge>
            <StatusBadge tone="info">{orderStatusLabel(order.orderStatus)}</StatusBadge>
            <StatusBadge>{paymentStatusLabel(order.paymentStatus)}</StatusBadge>
          </Link>
        ))}
      </div>
    </section>
  );
}

export { formatDate, formatOrderCode };
