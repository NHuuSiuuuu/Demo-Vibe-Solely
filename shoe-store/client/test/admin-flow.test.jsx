import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const adminUser = { id: 2, email: 'admin@shoestore.local', name: 'Admin User', role: 'admin' };
const customerUser = { id: 1, email: 'customer@shoestore.local', name: 'Customer User', role: 'customer' };

let adminProducts;
let adminOrders;

function resetProducts() {
  adminProducts = [
    {
      id: 10,
      slug: 'road-runner-1',
      name: 'Road Runner 1',
      description: 'Daily running shoe with cushioned support.',
      brand: 'Stride',
      category: 'Running',
      gender: 'unisex',
      price: 89.99,
      status: 'active',
      featured: true,
      totalStock: 8,
      variants: [
        { id: 101, productId: 10, sku: 'RR1-9-BLK', size: '9', color: 'Black', stockQuantity: 3, priceDelta: 0 },
        { id: 102, productId: 10, sku: 'RR1-10-WHT', size: '10', color: 'White', stockQuantity: 5, priceDelta: 5 }
      ]
    }
  ];
}

function resetOrders() {
  adminOrders = [
    {
      id: 900,
      orderCode: 'ORD-20260905-ABC123',
      userId: 1,
      customerEmail: 'customer@shoestore.local',
      customerName: 'Jordan Miles',
      shippingAddress: {
        line1: '1 Main St',
        line2: '',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US'
      },
      subtotal: 89.99,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 89.99,
      note: 'Ring bell',
      orderStatus: 'shipping',
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      createdAt: '2026-09-05T10:00:00.000Z',
      items: [
        {
          id: 700,
          productId: 10,
          variantId: 101,
          productName: 'Road Runner 1',
          sku: 'RR1-9-BLK',
          size: '9',
          color: 'Black',
          unitPrice: 89.99,
          quantity: 1,
          lineTotal: 89.99
        }
      ]
    },
    {
      id: 901,
      orderCode: 'ORD-20260905-PAID',
      customerEmail: 'paid@shoestore.local',
      customerName: 'Paid Customer',
      shippingAddress: { line1: '2 Main St', line2: '', city: 'Austin', state: 'TX', postalCode: '78702', country: 'US' },
      grandTotal: 1299.5,
      orderStatus: 'completed',
      paymentStatus: 'paid',
      createdAt: '2026-09-05T09:00:00.000Z',
      items: []
    },
    {
      id: 902,
      orderCode: 'ORD-20260905-PEN1',
      customerEmail: 'pending-1@shoestore.local',
      customerName: 'Pending One',
      shippingAddress: { line1: '3 Main St', line2: '', city: 'Austin', state: 'TX', postalCode: '78703', country: 'US' },
      grandTotal: 30,
      orderStatus: 'pending',
      paymentStatus: 'unpaid',
      createdAt: '2026-09-05T08:00:00.000Z',
      items: []
    },
    {
      id: 903,
      orderCode: 'ORD-20260905-PEN2',
      customerEmail: 'pending-2@shoestore.local',
      customerName: 'Pending Two',
      shippingAddress: { line1: '4 Main St', line2: '', city: 'Austin', state: 'TX', postalCode: '78704', country: 'US' },
      grandTotal: 40,
      orderStatus: 'pending',
      paymentStatus: 'unpaid',
      createdAt: '2026-09-05T07:00:00.000Z',
      items: []
    },
    {
      id: 904,
      orderCode: 'ORD-20260905-PEN3',
      customerEmail: 'pending-3@shoestore.local',
      customerName: 'Pending Three',
      shippingAddress: { line1: '5 Main St', line2: '', city: 'Austin', state: 'TX', postalCode: '78705', country: 'US' },
      grandTotal: 50,
      orderStatus: 'pending',
      paymentStatus: 'unpaid',
      createdAt: '2026-09-05T06:00:00.000Z',
      items: []
    }
  ];
}

function jsonResponse(payload, ok = true, statusText = 'OK') {
  return {
    ok,
    statusText,
    text: async () => JSON.stringify(payload)
  };
}

function createAdminFetchMock({ role = 'admin' } = {}) {
  return vi.fn(async (url, options = {}) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname;
    const method = options.method || 'GET';
    const user = role === 'admin' ? adminUser : customerUser;

    if (path === '/api/auth/me') {
      return jsonResponse({ user });
    }

    if (path === '/api/products') {
      return jsonResponse({ products: adminProducts });
    }

    if (path === '/api/products/road-runner-1') {
      return jsonResponse({ product: adminProducts[0] });
    }

    if (path === '/api/admin/dashboard') {
      return jsonResponse({
        dashboard: {
          productsCount: 12,
          variantsCount: 32,
          ordersCount: 7,
          pendingOrdersCount: 3,
          completedRevenue: 1299.5
        }
      });
    }

    if (path === '/api/admin/products' && method === 'GET') {
      return jsonResponse({ products: adminProducts });
    }

    if (path === '/api/admin/products/10' && method === 'GET') {
      return jsonResponse({ product: adminProducts[0] });
    }

    if (path === '/api/admin/products' && method === 'POST') {
      const body = JSON.parse(options.body);
      return jsonResponse({ product: { ...body, id: 22, createdAt: '2026-09-05T11:00:00.000Z' } });
    }

    if (path === '/api/admin/variants/101' && method === 'PATCH') {
      const body = JSON.parse(options.body);
      adminProducts[0].variants[0] = { ...adminProducts[0].variants[0], ...body };
      adminProducts[0].totalStock = adminProducts[0].variants.reduce((sum, variant) => sum + Number(variant.stockQuantity || 0), 0);
      return jsonResponse({ variant: adminProducts[0].variants[0] });
    }

    if (path === '/api/admin/orders' && method === 'GET') {
      return jsonResponse({ orders: adminOrders });
    }

    if (path === '/api/admin/orders/900' && method === 'GET') {
      return jsonResponse({ order: adminOrders[0] });
    }

    if (path === '/api/admin/orders/900/status' && method === 'PATCH') {
      const body = JSON.parse(options.body);
      adminOrders[0] = {
        ...adminOrders[0],
        orderStatus: body.status,
        paymentStatus: body.status === 'completed' ? 'paid' : adminOrders[0].paymentStatus
      };
      return jsonResponse({ order: adminOrders[0] });
    }

    return jsonResponse({ cart: { items: [], subtotal: 0 } });
  });
}

function renderWithToken(path, role = 'admin') {
  localStorage.setItem('shoe_store_token', `${role}-token`);
  window.history.pushState({}, '', path);
  const fetchMock = createAdminFetchMock({ role });
  global.fetch = fetchMock;
  render(<App />);
  return fetchMock;
}

describe('admin flow', () => {
  beforeEach(() => {
    localStorage.clear();
    resetProducts();
    resetOrders();
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('redirects non-admin users away from admin pages', async () => {
    renderWithToken('/admin', 'customer');

    await screen.findByRole('heading', { name: 'Di chuyển thật đẹp.' });
    expect(screen.queryByRole('heading', { name: 'Tổng quan quản trị' })).toBeNull();
    expect(window.location.pathname).toBe('/');
  });

  it('renders dashboard totals', async () => {
    renderWithToken('/admin');

    expect(await screen.findByRole('heading', { name: 'Tổng quan quản trị' })).toBeTruthy();
    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText(/1\.299,50\s*US\$/)).toBeTruthy();
  });

  it('renders product admin table', async () => {
    renderWithToken('/admin/products');

    const table = await screen.findByRole('table', { name: 'Sản phẩm quản trị' });
    expect(await within(table).findByText('Road Runner 1')).toBeTruthy();
    expect(within(table).getByText('Đang bán')).toBeTruthy();
    expect(within(table).getByText(/89,99\s*US\$/)).toBeTruthy();
    expect(within(table).getByText('8 đôi')).toBeTruthy();
  });

  it('submits product create form', async () => {
    const fetchMock = renderWithToken('/admin/products/new');

    await screen.findByRole('heading', { name: 'Tạo sản phẩm' });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'court-classic-low' } });
    fireEvent.change(screen.getByLabelText('Tên sản phẩm'), { target: { value: 'Court Classic Low' } });
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Low profile court shoe' } });
    fireEvent.change(screen.getByLabelText('Thương hiệu'), { target: { value: 'Stride' } });
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'Lifestyle' } });
    fireEvent.change(screen.getByLabelText('Giới tính'), { target: { value: 'unisex' } });
    fireEvent.change(screen.getByLabelText('Giá'), { target: { value: '74.99' } });
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'active' } });
    fireEvent.click(screen.getByLabelText('Nổi bật'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu sản phẩm' }));

    await screen.findByText('Đã lưu sản phẩm.');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/products'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          slug: 'court-classic-low',
          name: 'Court Classic Low',
          description: 'Low profile court shoe',
          brand: 'Stride',
          category: 'Lifestyle',
          gender: 'unisex',
          price: 74.99,
          status: 'active',
          featured: true
        })
      })
    );
  });

  it('renders and updates existing variants on the product edit form', async () => {
    const fetchMock = renderWithToken('/admin/products/10/edit');

    const variantsTable = await screen.findByRole('table', { name: 'Phiên bản sản phẩm' });
    const variantRow = within(variantsTable).getByDisplayValue('RR1-9-BLK').closest('tr');
    fireEvent.change(within(variantRow).getByLabelText('Tồn kho cho RR1-9-BLK'), { target: { value: '9' } });
    fireEvent.click(within(variantRow).getByRole('button', { name: 'Lưu RR1-9-BLK' }));

    await screen.findByText('Đã lưu phiên bản.');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/variants/101'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          sku: 'RR1-9-BLK',
          size: '9',
          color: 'Black',
          stockQuantity: 9,
          priceDelta: 0
        })
      })
    );
  });

  it('renders admin order list', async () => {
    renderWithToken('/admin/orders');

    const table = await screen.findByRole('table', { name: 'Đơn hàng quản trị' });
    const orderRow = within(table).getByText('ORD-20260905-ABC123').closest('tr');
    expect(within(orderRow).getByText('customer@shoestore.local')).toBeTruthy();
    expect(within(orderRow).getByText(/89,99\s*US\$/)).toBeTruthy();
    expect(within(orderRow).getByText('Đang giao')).toBeTruthy();
    expect(within(orderRow).getByText('Chưa thanh toán')).toBeTruthy();
  });

  it('updates order status to completed', async () => {
    renderWithToken('/admin/orders/900');

    await screen.findByRole('heading', { name: 'Đơn hàng ORD-20260905-ABC123' });
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang Hoàn thành' }));

    await screen.findByText('Đã cập nhật trạng thái đơn hàng.');
    expect(screen.getByText('Hoàn thành')).toBeTruthy();
    expect(screen.getByText('Đã thanh toán')).toBeTruthy();
  });
});
