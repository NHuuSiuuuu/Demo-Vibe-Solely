import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

function mockAuthResponse(role = 'customer') {
  return vi.fn(async (url, options = {}) => {
    if (String(url).endsWith('/api/auth/login')) {
      const body = JSON.parse(options.body);
      const payload = {
        token: `${role}-token`,
        user: {
          id: role === 'admin' ? 2 : 1,
          email: body.email,
          name: role === 'admin' ? 'Admin User' : 'Customer User',
          role
        }
      };

      return {
        ok: true,
        statusText: 'OK',
        text: async () => JSON.stringify(payload)
      };
    }

    return {
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify({ cart: { items: [], subtotal: 0 } })
    };
  });
}

async function loginAs(role) {
  global.fetch = mockAuthResponse(role);
  render(<App />);

  fireEvent.click(screen.getByRole('link', { name: /login/i }));
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: `${role}@example.com` }
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' }
  });
  fireEvent.click(screen.getByRole('button', { name: /login/i }));

  await screen.findByText(`${role}@example.com`);
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders navigation links', () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'Shoe Store' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Products' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cart' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Orders' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Login' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Register' })).toBeTruthy();
  });

  it('logs in and stores the current user', async () => {
    await loginAs('customer');

    await waitFor(() => {
      expect(localStorage.getItem('shoe_store_token')).toBe('customer-token');
    });
    expect(screen.getByText('customer@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: /logout/i })).toBeTruthy();
  });

  it('hides admin navigation for customer', async () => {
    await loginAs('customer');

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('shows admin navigation for admin', async () => {
    await loginAs('admin');

    expect(screen.getByRole('link', { name: 'Admin' })).toBeTruthy();
  });
});
