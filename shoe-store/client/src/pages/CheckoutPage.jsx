import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCart } from '../cart/CartContext.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';
import { formatMoney } from '../components/ProductCard.jsx';

const initialForm = {
  receiverName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Việt Nam',
  note: ''
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { cart, refreshCart } = useCart();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const payload = {
      receiverName: form.receiverName,
      phone: form.phone,
      shippingAddress: {
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country
      },
      note: form.note
    };

    try {
      const data = await apiClient.post('/api/orders', payload, { token });
      await refreshCart();
      navigate(`/orders/${data.order.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return <AuthPrompt message="Đăng nhập hoặc đăng ký để đặt hàng thanh toán khi nhận hàng." />;
  }

  return (
    <section className="checkout-layout" aria-labelledby="checkout-title">
      <form className="checkout-form" onSubmit={handleSubmit}>
        <h1 id="checkout-title">Thanh toán</h1>
        <label>
          Người nhận
          <input name="receiverName" value={form.receiverName} onChange={updateField} required />
        </label>
        <label>
          Số điện thoại
          <input name="phone" value={form.phone} onChange={updateField} required />
        </label>
        <label>
          Địa chỉ giao hàng
          <input name="line1" value={form.line1} onChange={updateField} required />
        </label>
        <label>
          Địa chỉ bổ sung
          <input name="line2" value={form.line2} onChange={updateField} />
        </label>
        <div className="form-grid">
          <label>
            Tỉnh / thành phố
            <input name="city" value={form.city} onChange={updateField} required />
          </label>
          <label>
            Quận / huyện
            <input name="state" value={form.state} onChange={updateField} required />
          </label>
          <label>
            Mã bưu chính
            <input name="postalCode" value={form.postalCode} onChange={updateField} required />
          </label>
          <label>
            Quốc gia
            <input name="country" value={form.country} onChange={updateField} required />
          </label>
        </div>
        <label>
          Ghi chú
          <textarea name="note" value={form.note} onChange={updateField} rows="3" />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={isSubmitting || (cart.items || []).length === 0}>
          {isSubmitting ? 'Đang đặt hàng...' : 'Đặt hàng COD'}
        </button>
      </form>

      <aside className="order-summary">
        <h2>Tóm tắt đơn COD</h2>
        {(cart.items || []).map((item) => (
          <div className="summary-item" key={item.id}>
            <span>
              <span>{item.productName}</span>
              <small> x {item.quantity}</small>
            </span>
            <strong>{formatMoney(item.lineTotal)}</strong>
          </div>
        ))}
        <div className="summary-row">
          <span>Tạm tính</span>
          <strong>{formatMoney(cart.subtotal)}</strong>
        </div>
        <div className="summary-row">
          <span>Thanh toán</span>
          <strong>Thanh toán khi nhận hàng</strong>
        </div>
      </aside>
    </section>
  );
}
