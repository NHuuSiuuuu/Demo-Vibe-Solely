import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useCart } from '../cart/CartContext.jsx';
import { formatMoney } from '../components/ProductCard.jsx';

const initialForm = {
  receiverName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
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

  return (
    <section className="checkout-layout" aria-labelledby="checkout-title">
      <form className="checkout-form" onSubmit={handleSubmit}>
        <h1 id="checkout-title">Checkout</h1>
        <label>
          Receiver name
          <input name="receiverName" value={form.receiverName} onChange={updateField} required />
        </label>
        <label>
          Phone
          <input name="phone" value={form.phone} onChange={updateField} required />
        </label>
        <label>
          Shipping address
          <input name="line1" value={form.line1} onChange={updateField} required />
        </label>
        <label>
          Address line 2
          <input name="line2" value={form.line2} onChange={updateField} />
        </label>
        <div className="form-grid">
          <label>
            City
            <input name="city" value={form.city} onChange={updateField} required />
          </label>
          <label>
            State
            <input name="state" value={form.state} onChange={updateField} required />
          </label>
          <label>
            Postal code
            <input name="postalCode" value={form.postalCode} onChange={updateField} required />
          </label>
          <label>
            Country
            <input name="country" value={form.country} onChange={updateField} required />
          </label>
        </div>
        <label>
          Note
          <textarea name="note" value={form.note} onChange={updateField} rows="3" />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={isSubmitting || (cart.items || []).length === 0}>
          {isSubmitting ? 'Placing order...' : 'Place COD order'}
        </button>
      </form>

      <aside className="order-summary">
        <h2>COD summary</h2>
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
          <span>Subtotal</span>
          <strong>{formatMoney(cart.subtotal)}</strong>
        </div>
        <div className="summary-row">
          <span>Payment</span>
          <strong>Cash on delivery</strong>
        </div>
      </aside>
    </section>
  );
}
