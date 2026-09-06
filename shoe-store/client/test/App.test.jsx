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

  fireEvent.click(screen.getAllByRole('link', { name: 'Tài khoản' })[0]);
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: `${role}@example.com` }
  });
  fireEvent.change(screen.getByLabelText(/mật khẩu/i), {
    target: { value: 'password123' }
  });
  fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }));

  await screen.findByRole('button', { name: /đăng xuất/i });
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

    expect(screen.getAllByRole('link', { name: 'Solely' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Hàng mới' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Sneaker' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Chạy bộ' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Phong cách sống' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tìm kiếm sản phẩm' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Tài khoản' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Danh sách yêu thích' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Túi hàng/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Tất cả điểm nhấn mới cho tủ giày của bạn' })).toBeTruthy();
    expect(
      screen.getByText('Sneaker Solely tối giản, êm nhẹ và đủ chỉn chu cho nhịp sống Việt mỗi ngày.')
    ).toBeTruthy();
  });

  it('logs in and stores the current user', async () => {
    await loginAs('customer');

    await waitFor(() => {
      expect(localStorage.getItem('shoe_store_token')).toBe('customer-token');
    });
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeTruthy();
  });

  it('hides admin navigation for customer', async () => {
    await loginAs('customer');

    expect(screen.queryByRole('link', { name: 'Quản trị' })).toBeNull();
  });

  it('shows admin navigation for admin', async () => {
    await loginAs('admin');

    expect(screen.getByRole('link', { name: 'Quản trị' })).toBeTruthy();
  });
});
