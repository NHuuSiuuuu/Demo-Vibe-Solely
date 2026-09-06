import { Link } from 'react-router-dom';

export default function AuthPrompt({ message = 'Đăng nhập hoặc đăng ký để tiếp tục mua sắm.' }) {
  return (
    <section className="auth-required" aria-labelledby="auth-required-title">
      <h1 id="auth-required-title">Đăng nhập để tiếp tục</h1>
      <p>{message}</p>
      <div className="auth-required__actions">
        <Link className="button-link" to="/login">
          Đăng nhập
        </Link>
        <Link className="button-secondary" to="/register">
          Đăng ký
        </Link>
      </div>
    </section>
  );
}
