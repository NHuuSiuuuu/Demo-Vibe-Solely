import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { paymentStatusLabel } from '../utils/formatters.js';
import { formatOrderCode } from './OrdersPage.jsx';

const RESULT_CONTENT = {
  paid: {
    title: 'Thanh toán thành công',
    message: 'Đơn hàng của bạn đã được VNPay thanh toán thành công.',
    tone: 'success'
  },
  failed: {
    title: 'Thanh toán không thành công',
    message: 'Giao dịch VNPay không thành công. Đơn hàng vẫn được lưu để bạn theo dõi.',
    tone: 'danger'
  },
  pending: {
    title: 'Đang xác minh thanh toán',
    message: 'VNPay đang xử lý giao dịch. Vui lòng kiểm tra lại trạng thái đơn hàng sau ít phút.',
    tone: 'info'
  }
};

export default function PaymentResultPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setOrder(null);
    setError('');
    if (!token || !orderId) {
      return undefined;
    }

    let cancelled = false;
    apiClient
      .get(`/api/orders/${orderId}`, { token })
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
  }, [orderId, token]);

  if (!token) {
    return <AuthPrompt message="Đăng nhập để xác minh kết quả thanh toán VNPay." />;
  }

  if (!orderId || error || (order && order.paymentMethod !== 'vnpay')) {
    return (
      <section className="payment-result payment-result--danger" aria-labelledby="payment-result-title">
        <p className="eyebrow">Kết quả VNPay</p>
        <h1 id="payment-result-title">Không thể xác minh thanh toán</h1>
        <p>{error || 'Thông tin trả về không hợp lệ hoặc không thuộc một đơn hàng VNPay.'}</p>
        <Link className="button-link" to="/orders">Xem đơn hàng</Link>
      </section>
    );
  }

  const status = order?.paymentStatus || 'pending';
  const content = RESULT_CONTENT[status] || RESULT_CONTENT.pending;

  return (
    <section className={`payment-result payment-result--${content.tone}`} aria-labelledby="payment-result-title">
      <p className="eyebrow">Kết quả VNPay</p>
      <h1 id="payment-result-title">{content.title}</h1>
      <p>{order ? content.message : 'Đang tải trạng thái đơn hàng từ Solely...'}</p>
      {order ? (
        <>
          <StatusBadge tone={content.tone}>{paymentStatusLabel(order.paymentStatus)}</StatusBadge>
          <p>Đơn hàng {formatOrderCode(order)}</p>
          <div className="payment-result__actions">
            <Link className="button-link" to={`/orders/${order.id}`}>Xem chi tiết đơn hàng</Link>
            <Link className="button-secondary" to="/orders">Tất cả đơn hàng</Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
