import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../src/api/client.js';
import CartPage from '../src/pages/CartPage.jsx';
import CheckoutPage from '../src/pages/CheckoutPage.jsx';
import OrderDetailPage from '../src/pages/OrderDetailPage.jsx';
import AdminOrderDetailPage from '../src/pages/admin/AdminOrderDetailPage.jsx';

vi.mock('../src/auth/AuthContext.jsx', () => ({ useAuth: () => ({ token: 'test-token' }) }));
vi.mock('../src/cart/CartContext.jsx', () => ({ useCart: () => ({ cart, updateItem() {}, removeItem() {}, refreshCart() {} }) }));
const items = [
  { basePrice: 101, discountPercent: 50, unitPrice: 51, lineTotal: 153 },
  { basePrice: null, discountPercent: null, unitPrice: 75, lineTotal: 225 },
  { basePrice: 120, discountPercent: null, unitPrice: 110, lineTotal: 330 },
  { basePrice: null, discountPercent: 0, unitPrice: 80, lineTotal: 240 },
  { basePrice: 0, discountPercent: 100, unitPrice: 0, lineTotal: 0 },
  { unitPrice: 95, lineTotal: 285 }
].map((pricing, index) => ({ id: index + 1, productName: `Shoe ${index + 1}`, sku: `SKU-${index + 1}`,
  size: '42', color: 'black', quantity: 3, stockQuantity: 10, ...pricing }));
const cart = { items, subtotal: 1233 };
const order = { id: 1, orderCode: 'ORD-1', shippingAddress: {}, paymentMethod: 'cod',
  paymentStatus: 'unpaid', orderStatus: 'pending', items, grandTotal: 1233 };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([
  ['/cart', CartPage], ['/checkout', CheckoutPage], ['/orders/1', OrderDetailPage], ['/admin/orders/1', AdminOrderDetailPage]
])('%s renders only supplied pricing context, including zero and partial historical snapshots', async (path, Page) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ order });
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path={path.replace('/1', '/:id')} element={<Page />} /></Routes></MemoryRouter>);
  await screen.findByText(/Shoe 1/);
  const row = (name) => within(screen.getByText(new RegExp(name)).closest('.line-item, .summary-item'));
  expect(row('Shoe 1').getByText(/Giá gốc: 101\s*₫/)).toBeTruthy();
  expect(row('Shoe 1').getByText(/Giảm giá: 50%/)).toBeTruthy();
  expect(row('Shoe 1').getByText(/^153\s*₫$/)).toBeTruthy();
  for (const name of ['Shoe 2', 'Shoe 6']) {
    expect(row(name).queryByText(/Giá gốc:/)).toBeNull();
    expect(row(name).queryByText(/Giảm giá:/)).toBeNull();
  }
  expect(row('Shoe 2').getByText(/^225\s*₫$/)).toBeTruthy();
  expect(row('Shoe 3').getByText(/Giá gốc: 120\s*₫/)).toBeTruthy();
  expect(row('Shoe 3').queryByText(/Giảm giá:/)).toBeNull();
  expect(row('Shoe 4').queryByText(/Giá gốc:/)).toBeNull();
  expect(row('Shoe 4').getByText(/Giảm giá: 0%/)).toBeTruthy();
  expect(row('Shoe 5').getByText(/Giá gốc: 0\s*₫/)).toBeTruthy();
  expect(row('Shoe 5').getByText(/Giảm giá: 100%/)).toBeTruthy();
});
