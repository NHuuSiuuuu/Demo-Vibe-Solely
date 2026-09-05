import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ProductCard from './ProductCard.jsx';

export default function AiAssistant() {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token || !user) {
      return;
    }

    setError('');
    setAnswer('');
    setProducts([]);
    setIsSending(true);

    try {
      const data = await apiClient.post('/api/ai/chat', { message }, { token });
      setAnswer(data.answer);
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside className="ai-assistant" aria-label="Shopping assistant">
      {isOpen ? (
        <div className="ai-panel">
          <div className="ai-panel__header">
            <h2>Shopping assistant</h2>
            <button type="button" className="button-secondary" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
          {!token || !user ? (
            <div className="ai-auth-links">
              <p>Login or register to get product recommendations.</p>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </div>
          ) : (
            <form className="ai-form" onSubmit={handleSubmit}>
              <label htmlFor="ai-message">Ask for product advice</label>
              <textarea
                id="ai-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows="3"
                required
              />
              {error ? <p className="form-error">{error}</p> : null}
              <button type="submit" disabled={isSending || !message.trim()}>
                {isSending ? 'Sending...' : 'Send advice request'}
              </button>
            </form>
          )}
          {answer ? <p className="ai-answer">{answer}</p> : null}
          {products.length > 0 ? (
            <section className="ai-recommendations" aria-labelledby="ai-recommendations-title">
              <h3 id="ai-recommendations-title">Recommended products</h3>
              <div className="ai-product-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} compact />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <button type="button" className="ai-toggle" onClick={() => setIsOpen(true)}>
          Open shopping assistant
        </button>
      )}
    </aside>
  );
}
