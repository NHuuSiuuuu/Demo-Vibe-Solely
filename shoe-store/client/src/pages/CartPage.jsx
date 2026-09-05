import { Link } from 'react-router-dom';
import { useCart } from '../cart/CartContext.jsx';
import { formatMoney } from '../components/ProductCard.jsx';

export default function CartPage() {
  const { cart, updateItem, removeItem } = useCart();
  const items = cart.items || [];

  async function updateQuantity(item, value) {
    await updateItem(item.id, Number(value));
  }

  return (
    <section className="shop-page" aria-labelledby="cart-title">
      <div className="section-heading">
        <h1 id="cart-title">Cart</h1>
        <Link className="button-link" to="/checkout">
          Checkout
        </Link>
      </div>
      {items.length === 0 ? <p className="muted">Your cart is empty.</p> : null}
      <div className="line-items">
        {items.map((item) => (
          <article className="line-item" key={item.id}>
            <div>
              <h2>{item.productName}</h2>
              <p>
                Size {item.size} / {item.color} / {item.sku}
              </p>
            </div>
            <p>{formatMoney(item.unitPrice)}</p>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                max={item.stockQuantity}
                value={item.quantity}
                onChange={(event) => updateQuantity(item, event.target.value)}
              />
            </label>
            <p>{formatMoney(item.lineTotal)}</p>
            <button type="button" className="button-secondary" onClick={() => removeItem(item.id)}>
              Remove
            </button>
          </article>
        ))}
      </div>
      <div className="summary-row">
        <span>Subtotal</span>
        <strong>{formatMoney(cart.subtotal)}</strong>
      </div>
    </section>
  );
}
