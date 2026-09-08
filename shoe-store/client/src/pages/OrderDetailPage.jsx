import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';
import ItemPriceDetails from '../components/ItemPriceDetails.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import { formatMoney } from '../components/ProductCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { colorLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from '../utils/formatters.js';
import { formatOrderCode } from './OrdersPage.jsx';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  if (!token) {
    return <AuthPrompt message="Đăng nhập hoặc đăng ký để theo dõi đơn hàng này." />;
  }
  // Route/auth identity owns all loaded data and in-flight resume state.
  return <OrderDetail key={JSON.stringify([id, token])} id={id} token={token} />;
}

function OrderDetail({ id, token }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [retryError, setRetryError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const active = useRef(false);

  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function resumePayment() {
    if (!active.current || isRetrying) return;
    setRetryError('');
    setIsRetrying(true);
    try {
      const data = await apiClient.post(`/api/orders/${order.id}/payment-url`, {}, { token });
      if (!active.current) return;
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
      if (active.current) setRetryError(err.message);
    } finally {
      if (active.current) setIsRetrying(false);
    }
  }

  async function cancelOrder() {
    setActionMessage('');
    setError('');
    setIsCancelling(true);
    try {
      const data = await apiClient.post(`/api/orders/${order.id}/cancel`, {}, { token });
      if (!active.current) return;
      setOrder(data.order);
      setActionMessage(data.order.paymentStatus === 'refund_pending'
        ? 'Đơn VNPay đã hủy. Shop đang xử lý hoàn tiền.'
        : data.order.paymentMethod === 'cod'
          ? 'Đơn COD đã được hủy. Bạn không cần thanh toán.'
          : 'Đơn VNPay đã hủy và giao dịch chưa phát sinh hoàn tiền.');
    } catch (err) {
      if (active.current) setError(err.message);
    } finally {
      if (active.current) setIsCancelling(false);
    }
  }

  useEffect(() => {
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

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!order) {
    return <p className="muted">Đang tải đơn hàng...</p>;
  }

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
          {['pending', 'confirmed'].includes(order.orderStatus) ? (
            <button type="button" className="button-secondary" onClick={cancelOrder} disabled={isCancelling}>
              {isCancelling ? 'Đang hủy đơn...' : 'Hủy đơn hàng'}
            </button>
          ) : null}
          {actionMessage ? <p className="success-message" role="status">{actionMessage}</p> : null}
          {order.note ? <p>Ghi chú: {order.note}</p> : null}
        </div>
        <StatusBadge tone="info">{orderStatusLabel(order.orderStatus)}</StatusBadge>
      </div>

      <OrderTimeline order={order} />

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
                <br />
                <ItemPriceDetails item={item} />
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
