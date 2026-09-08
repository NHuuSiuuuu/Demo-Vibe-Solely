import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatMoney } from '../../components/ProductCard.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import ItemPriceDetails from '../../components/ItemPriceDetails.jsx';
import OrderTimeline from '../../components/OrderTimeline.jsx';
import { colorLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from '../../utils/formatters.js';
import { formatOrderCode } from '../OrdersPage.jsx';

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
      setMessage('Đã cập nhật trạng thái đơn hàng.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmRefund() {
    setMessage('');
    setError('');
    try {
      const data = await apiClient.post(`/api/admin/orders/${id}/refund-confirmation`, {}, { token });
      setOrder(data.order);
      setMessage('Đã xác nhận hoàn tiền VNPay.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === 'loading') {
    return <p className="muted">Đang tải đơn hàng...</p>;
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
            Quay lại đơn hàng
          </Link>
          <h1 id="admin-order-title">Đơn hàng {formatOrderCode(order)}</h1>
          <p>{order.customerEmail}</p>
          <p>Phương thức: {paymentMethodLabel(order.paymentMethod)}</p>
          <p className="muted">{order.paymentMethod === 'cod'
            ? 'Khách thanh toán khi nhận hàng.'
            : order.paymentStatus === 'refund_pending'
              ? 'Đơn đã hủy; cần hoàn tiền cho khách rồi xác nhận.'
              : 'Thanh toán online qua VNPay.'}</p>
          {order.note ? <p>Ghi chú: {order.note}</p> : null}
        </div>
        <div className="admin-status-stack">
          <StatusBadge tone="info">{orderStatusLabel(order.orderStatus)}</StatusBadge>
          <StatusBadge>{paymentStatusLabel(order.paymentStatus)}</StatusBadge>
        </div>
      </div>
      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="admin-actions">
        {availableStatuses.map((nextStatus) => (
          <button type="button" key={nextStatus} onClick={() => updateStatus(nextStatus)}>
            Chuyển sang {orderStatusLabel(nextStatus)}
          </button>
        ))}
        {order.paymentMethod === 'vnpay' && order.paymentStatus === 'refund_pending' ? (
          <button type="button" onClick={confirmRefund}>Xác nhận đã hoàn tiền</button>
        ) : null}
      </div>

      <OrderTimeline order={order} />

      <div className="detail-grid">
        <section className="content-panel" aria-labelledby="admin-customer-title">
          <h2 id="admin-customer-title">Khách hàng</h2>
          <p>{order.customerName}</p>
          <p>{order.customerEmail}</p>
          <p>
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
          </p>
        </section>
        <section className="content-panel" aria-labelledby="admin-order-items-title">
          <h2 id="admin-order-items-title">Sản phẩm</h2>
          {(order.items || []).map((item) => (
            <article className="summary-item" key={item.id}>
              <span>
                {item.productName} / {item.sku} / size {item.size} / {colorLabel(item.color)} x {item.quantity}
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
