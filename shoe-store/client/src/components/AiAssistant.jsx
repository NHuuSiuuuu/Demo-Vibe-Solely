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
    <aside className="ai-assistant" aria-label="Trợ lý mua sắm">
      {isOpen ? (
        <div className="ai-panel">
          <div className="ai-panel__header">
            <h2>Trợ lý mua sắm</h2>
            <button type="button" className="button-secondary" onClick={() => setIsOpen(false)}>
              Đóng
            </button>
          </div>
          {!token || !user ? (
            <div className="ai-auth-links">
              <p>Đăng nhập hoặc đăng ký để nhận tư vấn sản phẩm phù hợp.</p>
              <Link to="/login">Đăng nhập</Link>
              <Link to="/register">Đăng ký</Link>
            </div>
          ) : (
            <form className="ai-form" onSubmit={handleSubmit}>
              <label htmlFor="ai-message">Nhập câu hỏi tư vấn sản phẩm</label>
              <textarea
                id="ai-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows="3"
                required
              />
              {error ? <p className="form-error">{error}</p> : null}
              <button type="submit" disabled={isSending || !message.trim()}>
                {isSending ? 'Đang gửi...' : 'Gửi yêu cầu tư vấn'}
              </button>
            </form>
          )}
          {answer ? <p className="ai-answer">{answer}</p> : null}
          {products.length > 0 ? (
            <section className="ai-recommendations" aria-labelledby="ai-recommendations-title">
              <h3 id="ai-recommendations-title">Sản phẩm gợi ý</h3>
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
          Mở trợ lý mua sắm
        </button>
      )}
    </aside>
  );
}
