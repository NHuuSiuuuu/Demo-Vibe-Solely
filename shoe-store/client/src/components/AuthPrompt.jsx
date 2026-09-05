import { Link } from 'react-router-dom';

export default function AuthPrompt({ message = 'Login or register to continue shopping.' }) {
  return (
    <section className="auth-required" aria-labelledby="auth-required-title">
      <h1 id="auth-required-title">Login to continue</h1>
      <p>{message}</p>
      <div className="auth-required__actions">
        <Link className="button-link" to="/login">
          Login
        </Link>
        <Link className="button-secondary" to="/register">
          Register
        </Link>
      </div>
    </section>
  );
}
