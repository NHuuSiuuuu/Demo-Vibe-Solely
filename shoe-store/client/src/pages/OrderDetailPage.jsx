import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';
import { formatMoney } from '../components/ProductCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const timelineSteps = ['pending', 'confirmed', 'shipping', 'completed'];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setOrder(null);
      return undefined;
    }

    let cancelled = false;
    apiClient
      .get(`/api/orders/${id}`, { token })
      .then((data) => {
        if (!cancelled) {
          setOrder(data.order);
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
  }, [id, token]);

  if (!token) {
    return <AuthPrompt message="Login or register to track this order." />;
  }

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!order) {
    return <p className="muted">Loading order...</p>;
  }

  const activeIndex = timelineSteps.indexOf(order.orderStatus);

  return (
    <section className="shop-page" aria-labelledby="order-title">
      <div className="section-heading">
        <div>
          <h1 id="order-title">Order ORD-{order.id}</h1>
          <p>Payment: {order.paymentStatus}</p>
        </div>
        <StatusBadge tone="info">{order.orderStatus}</StatusBadge>
      </div>

      <ol className="timeline" aria-label="Order status timeline">
        {timelineSteps.map((step, index) => (
          <li className={index <= activeIndex ? 'timeline__step timeline__step--active' : 'timeline__step'} key={step}>
            <span>{step}</span>
            {index === activeIndex ? <strong>Current</strong> : null}
          </li>
        ))}
      </ol>

      <div className="detail-grid">
        <section className="content-panel" aria-labelledby="shipping-title">
          <h2 id="shipping-title">Receiver and shipping</h2>
          <p>{order.customerName}</p>
          <p>{order.customerEmail}</p>
          <p>
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
          </p>
        </section>

        <section className="content-panel" aria-labelledby="items-title">
          <h2 id="items-title">Purchased items</h2>
          {(order.items || []).map((item) => (
            <article className="summary-item" key={item.id}>
              <span>
                {item.productName} / size {item.size} / {item.color} x {item.quantity}
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
