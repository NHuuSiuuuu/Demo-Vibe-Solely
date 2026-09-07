import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';
import { formatMoney } from '../components/ProductCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { colorLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from '../utils/formatters.js';
import { formatOrderCode } from './OrdersPage.jsx';

const timelineSteps = ['pending', 'confirmed', 'shipping', 'completed'];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [retryError, setRetryError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  async function resumePayment() {
    setRetryError('');
    setIsRetrying(true);
    try {
      const data = await apiClient.post(`/api/orders/${order.id}/payment-url`, {}, { token });
      const paymentUrl = typeof data.paymentUrl === 'string' ? data.paymentUrl.trim() : '';
      if (!paymentUrl) throw new Error('Không nhận được đường dẫn thanh toán VNPay. Vui lòng thử lại.');
      const link = document.createElement('a');
      link.href = paymentUrl;
      link.rel = 'noreferrer';
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setRetryError(err.message);
    } finally {
      setIsRetrying(false);
    }
  }

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
    return <AuthPrompt message="Đăng nhập hoặc đăng ký để theo dõi đơn hàng này." />;
  }

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!order) {
    return <p className="muted">Đang tải đơn hàng...</p>;
  }

  const activeIndex = timelineSteps.indexOf(order.orderStatus);

  return (
    <section className="shop-page" aria-labelledby="order-title">
      <div className="section-heading">
        <div>
          <h1 id="order-title">Đơn hàng {formatOrderCode(order)}</h1>
          <p>Phương thức: {paymentMethodLabel(order.paymentMethod)}</p>
          <p>Thanh toán: {paymentStatusLabel(order.paymentStatus)}</p>
          {order.paymentMethod === 'vnpay' && order.paymentStatus === 'pending'
            && ['pending', 'confirmed'].includes(order.orderStatus) ? (
              <button type="button" onClick={resumePayment} disabled={isRetrying}>
                {isRetrying ? 'Đang tạo đường dẫn...' : 'Tiếp tục thanh toán VNPay'}
              </button>
            ) : null}
          {retryError ? <p className="form-error" role="alert">{retryError}</p> : null}
          {order.note ? <p>Ghi chú: {order.note}</p> : null}
        </div>
        <StatusBadge tone="info">{orderStatusLabel(order.orderStatus)}</StatusBadge>
      </div>

      <ol className="timeline" aria-label="Tiến trình trạng thái đơn hàng">
        {timelineSteps.map((step, index) => (
          <li className={index <= activeIndex ? 'timeline__step timeline__step--active' : 'timeline__step'} key={step}>
            <span>{orderStatusLabel(step)}</span>
            {index === activeIndex ? <strong>Hiện tại</strong> : null}
          </li>
        ))}
      </ol>

      <div className="detail-grid">
        <section className="content-panel" aria-labelledby="shipping-title">
          <h2 id="shipping-title">Người nhận và giao hàng</h2>
          <p>{order.customerName}</p>
          <p>{order.customerEmail}</p>
          <p>
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
          </p>
        </section>

        <section className="content-panel" aria-labelledby="items-title">
          <h2 id="items-title">Sản phẩm đã mua</h2>
          {(order.items || []).map((item) => (
            <article className="summary-item" key={item.id}>
              <span>
                {item.productName} / size {item.size} / {colorLabel(item.color)} x {item.quantity}
              </span>
              <strong>{formatMoney(item.lineTotal)}</strong>
            </article>
          ))}
          <div className="summary-row">
            <span>Tổng cộng</span>
            <strong>{formatMoney(order.grandTotal)}</strong>
          </div>
        </section>
      </div>
    </section>
  );
}
