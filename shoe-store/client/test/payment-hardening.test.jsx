import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { apiClient } from '../src/api/client.js';
import PaymentResultPage from '../src/pages/PaymentResultPage.jsx';
import OrderDetailPage from '../src/pages/OrderDetailPage.jsx';

vi.mock('../src/auth/AuthContext.jsx', () => ({ useAuth: () => ({ token: 'customer-token' }) }));
const order = { id: 1, orderCode: 'ORD-1', paymentMethod: 'vnpay', paymentStatus: 'paid',
  orderStatus: 'pending', shippingAddress: {}, items: [], grandTotal: 153 };
function renderPage(path = '/payment-result?orderId=1') {
  const router = createMemoryRouter([
    { path: '/payment-result', element: <PaymentResultPage /> },
    { path: '/orders/:id', element: <OrderDetailPage /> }
  ], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('payment result navigation', () => {
  it('clears the previous paid order while the newly requested order is loading', async () => {
    let resolveNext;
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ order })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
    const router = renderPage();
    await screen.findByRole('heading', { name: 'Thanh toán thành công' });
    await act(() => router.navigate('/payment-result?orderId=2'));
    expect(screen.queryByRole('heading', { name: 'Thanh toán thành công' })).toBeNull();
    expect(screen.queryByText('Đơn hàng ORD-1')).toBeNull();
    expect(screen.getByText('Đang tải trạng thái đơn hàng từ Solely...')).toBeTruthy();
    await act(() => resolveNext({ order: { ...order, id: 2, paymentStatus: 'failed' } }));
    expect(await screen.findByRole('heading', { name: 'Thanh toán không thành công' })).toBeTruthy();
  });

  it('clears a previous error before fetching another order', async () => {
    let resolveNext;
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Order not found'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
    const router = renderPage();
    await screen.findByText('Order not found');
    await act(() => router.navigate('/payment-result?orderId=2'));
    expect(screen.queryByText('Order not found')).toBeNull();
    expect(screen.getByText('Đang tải trạng thái đơn hàng từ Solely...')).toBeTruthy();
    await act(() => resolveNext({ order: { ...order, id: 2 } }));
    expect(await screen.findByRole('heading', { name: 'Thanh toán thành công' })).toBeTruthy();
  });

  it('ignores a stale response after changing the requested order', async () => {
    let resolveOld;
    vi.spyOn(apiClient, 'get').mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ order: { ...order, id: 2, paymentStatus: 'pending' } });
    const router = renderPage();
    await act(() => router.navigate('/payment-result?orderId=2'));
    await screen.findByText('Đang chờ thanh toán');
    await act(() => resolveOld({ order }));
    expect(screen.queryByRole('heading', { name: 'Thanh toán thành công' })).toBeNull();
  });
});

describe('order payment resume', () => {
  it('requests the owned order payment URL and disables duplicate clicks until redirect', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ order: { ...order, paymentStatus: 'pending' } });
    let resolveUrl;
    const post = vi.spyOn(apiClient, 'post').mockImplementation(() => new Promise((resolve) => { resolveUrl = resolve; }));
    const redirected = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { redirected.push(this.href); });
    renderPage('/orders/1');
    const button = await screen.findByRole('button', { name: 'Tiếp tục thanh toán VNPay' });
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/api/orders/1/payment-url', {}, { token: 'customer-token' });
    const paymentUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=1';
    await act(() => resolveUrl({ paymentUrl }));
    await waitFor(() => expect(redirected).toEqual([paymentUrl]));
  });

  it('shows retry errors inline and allows another request', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ order: { ...order, paymentStatus: 'pending' } });
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Only pending VNPay payments can be resumed'));
    renderPage('/orders/1');
    fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục thanh toán VNPay' }));
    expect(await screen.findByText('Only pending VNPay payments can be resumed')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Đơn hàng ORD-1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tiếp tục thanh toán VNPay' }).disabled).toBe(false);
  });

  it.each([
    ['cod', 'unpaid', 'pending'], ['vnpay', 'paid', 'pending'], ['vnpay', 'failed', 'pending'],
    ['vnpay', 'pending', 'cancelled'], ['vnpay', 'pending', 'shipping'], ['vnpay', 'pending', 'completed']
  ])('hides retry for %s / %s / %s', async (paymentMethod, paymentStatus, orderStatus) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ order: { ...order, paymentMethod, paymentStatus, orderStatus } });
    renderPage('/orders/1');
    await screen.findByRole('heading', { name: 'Đơn hàng ORD-1' });
    expect(screen.queryByRole('button', { name: 'Tiếp tục thanh toán VNPay' })).toBeNull();
  });
});
