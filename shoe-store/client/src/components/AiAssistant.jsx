import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ProductCard from './ProductCard.jsx';

const welcomeMessage = {
  id: 'welcome',
  sender: 'assistant',
  content: 'Chào anh, em có thể gợi ý giày theo ngân sách, size và mục đích sử dụng.'
};

export default function AiAssistant() {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([welcomeMessage]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, isSending]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token || !user) {
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    const requestId = Date.now();
    setError('');
    setProducts([]);
    setMessage('');
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${requestId}`,
        sender: 'user',
        content: trimmedMessage
      }
    ]);
    setIsSending(true);

    try {
      const data = await apiClient.post('/api/ai/chat', { message: trimmedMessage }, { token });
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${requestId}`,
          sender: 'assistant',
          content: data.answer
        }
      ]);
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-error-${requestId}`,
          sender: 'assistant',
          content: 'Em chưa gửi được yêu cầu tư vấn. Anh thử lại sau ít phút.'
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside className="ai-assistant" aria-label="Trợ lý mua sắm">
      {isOpen ? (
        <div className="ai-panel">
          <div className="ai-panel__header">
            <div className="ai-panel__identity">
              <span className="ai-panel__avatar" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <div>
                <h2>Trợ lý mua sắm</h2>
                <p>Online - tư vấn theo catalog Solely</p>
              </div>
            </div>
            <button type="button" className="ai-close-button" onClick={() => setIsOpen(false)} aria-label="Đóng trợ lý mua sắm">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {!token || !user ? (
            <div className="ai-auth-links">
              <p>Đăng nhập hoặc đăng ký để nhận tư vấn sản phẩm phù hợp.</p>
              <Link to="/login">Đăng nhập</Link>
              <Link to="/register">Đăng ký</Link>
            </div>
          ) : (
            <>
              <div className="ai-message-log" role="log" aria-label="Tin nhắn trợ lý mua sắm" aria-live="polite">
                {messages.map((chatMessage) => (
                  <div className={`ai-message-row ai-message-row--${chatMessage.sender}`} key={chatMessage.id}>
                    {chatMessage.sender === 'assistant' ? (
                      <span className="ai-message-avatar" aria-hidden="true">
                        <Sparkles size={14} />
                      </span>
                    ) : null}
                    <p className="ai-message-bubble">{chatMessage.content}</p>
                  </div>
                ))}
                {isSending ? (
                  <div className="ai-message-row ai-message-row--assistant">
                    <span className="ai-message-avatar" aria-hidden="true">
                      <Sparkles size={14} />
                    </span>
                    <div className="ai-typing" role="status" aria-label="Trợ lý đang trả lời">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
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
              <form className="ai-form" onSubmit={handleSubmit}>
                <label htmlFor="ai-message">Nhập câu hỏi tư vấn sản phẩm</label>
                <div className="ai-composer">
                  <textarea
                    id="ai-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows="2"
                    required
                    placeholder="Ví dụ: giày nam size 42 dưới 2 triệu để chạy bộ"
                  />
                  <button type="submit" disabled={isSending || !message.trim()}>
                    <Send size={16} aria-hidden="true" />
                    <span>Gửi yêu cầu tư vấn</span>
                  </button>
                </div>
                {error ? <p className="form-error">{error}</p> : null}
              </form>
            </>
          )}
        </div>
      ) : (
        <button type="button" className="ai-toggle" onClick={() => setIsOpen(true)}>
          <Sparkles size={18} aria-hidden="true" />
          <span>Mở trợ lý mua sắm</span>
        </button>
      )}
    </aside>
  );
}
