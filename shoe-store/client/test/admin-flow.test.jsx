import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const adminUser = { id: 2, email: 'admin@shoestore.local', name: 'Admin User', role: 'admin' };
const customerUser = { id: 1, email: 'customer@shoestore.local', name: 'Customer User', role: 'customer' };

let adminProducts;
let adminOrders;
let imageOverviewHandler;
let imageReindexAllHandler;
let imageReindexProductHandler;

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
      price: 1890000,
      status: 'active',
      featured: true,
      totalStock: 8,
      variants: [
        { id: 101, productId: 10, sku: 'RR1-9-BLK', size: '9', color: 'Black', stockQuantity: 3, discountPercent: 0 },
        { id: 102, productId: 10, sku: 'RR1-10-WHT', size: '10', color: 'White', stockQuantity: 5, discountPercent: 10 }
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
      subtotal: 1890000,
      shippingTotal: 0,
      taxTotal: 0,
      grandTotal: 1890000,
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
          unitPrice: 1890000,
          quantity: 1,
          lineTotal: 1890000
        }
      ]
    },
    {
      id: 901,
      orderCode: 'ORD-20260905-PAID',
      customerEmail: 'paid@shoestore.local',
      customerName: 'Paid Customer',
      shippingAddress: { line1: '2 Main St', line2: '', city: 'Austin', state: 'TX', postalCode: '78702', country: 'US' },
      grandTotal: 12995000,
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
      grandTotal: 300000,
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
      grandTotal: 400000,
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
      grandTotal: 500000,
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
          completedRevenue: 12995000
        }
      });
    }

    if (path === '/api/admin/rag/overview' && method === 'GET') {
      return jsonResponse({
        overview: {
          available: true,
          geminiConfigured: true,
          pgvectorAvailable: true,
          documentCount: 2,
          chunkCount: 8,
          needsReindexCount: 1,
          documentCountsByStatus: { active: 1, hidden: 0, needsReindex: 1 },
          chunkCountsBySourceType: { document: 4, product: 4 },
          indexedProductCount: 1,
          staleProductCount: 1,
          lastIndexedAt: '2026-09-05T12:00:00.000Z'
        }
      });
    }

    if (path === '/api/admin/rag/documents' && method === 'GET') {
      return jsonResponse({
        documents: [
          {
            id: 7,
            title: 'Chính sách đổi trả',
            slug: 'chinh-sach-doi-tra',
            documentType: 'returns',
            content: 'Khách có thể đổi trả khi sản phẩm còn nguyên hộp.',
            status: 'active',
            lastIndexedAt: '2026-09-05T12:00:00.000Z',
            createdAt: '2026-09-05T00:00:00.000Z',
            updatedAt: '2026-09-05T00:00:00.000Z'
          }
        ]
      });
    }

    if (path === '/api/admin/rag/image-overview' && method === 'GET') {
      return imageOverviewHandler();
    }

    if (path === '/api/admin/rag/images/reindex' && method === 'POST') {
      return imageReindexAllHandler();
    }

    if (path === '/api/admin/rag/products/10/image-reindex' && method === 'POST') {
      return imageReindexProductHandler();
    }

    if (path === '/api/admin/rag/products/10/reindex' && method === 'POST') {
      return jsonResponse({ result: { status: 'indexed', chunksIndexed: 1 } });
    }

    if (path === '/api/admin/products' && method === 'GET') {
      return jsonResponse({ products: adminProducts });
    }

    if (path === '/api/admin/categories' && method === 'GET') {
      return jsonResponse({ categories: [{ id: 1, name: 'Lifestyle', slug: 'Lifestyle', status: 'active' }] });
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
    imageOverviewHandler = async () => jsonResponse({
      overview: {
        totalImages: 14,
        indexedCount: 10,
        errorCount: 2,
        needsReindexCount: 1,
        model: 'gemini-embedding-2',
        dimension: 768,
        lastIndexedAt: '2026-09-07T09:00:00.000Z'
      }
    });
    imageReindexAllHandler = async () => jsonResponse({ summary: { indexed: 11, failed: 3 } });
    imageReindexProductHandler = async () => jsonResponse({ summary: { indexed: 2, failed: 1 } });
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('redirects non-admin users away from admin pages', async () => {
    renderWithToken('/admin', 'customer');

    await screen.findByRole('heading', { name: 'Tất cả điểm nhấn mới cho tủ giày của bạn' });
    expect(screen.queryByRole('heading', { name: 'Tổng quan quản trị' })).toBeNull();
    expect(window.location.pathname).toBe('/');
  });

  it('renders dashboard totals', async () => {
    renderWithToken('/admin');

    expect(await screen.findByRole('heading', { name: 'Tổng quan quản trị' })).toBeTruthy();
    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getAllByText(/12\.995\.000\s*₫/).length).toBeGreaterThan(0);
  });

  it('renders admin pages without the customer storefront shell', async () => {
    renderWithToken('/admin');

    expect(await screen.findByRole('heading', { name: 'Tổng quan quản trị' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Điều hướng quản trị' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Hàng mới' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Túi hàng/i })).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });

  it('shows RAG knowledge page in admin navigation', async () => {
    renderWithToken('/admin');

    expect(await screen.findByText('Kho tri thức AI')).toBeTruthy();
  });

  it('renders RAG overview, policy documents, and test query UI', async () => {
    renderWithToken('/admin/rag');

    expect(await screen.findByText('Tổng quan tri thức')).toBeTruthy();
    expect(screen.getByText('Chính sách')).toBeTruthy();
    expect(screen.getByText('Kiểm thử truy vấn')).toBeTruthy();
  });

  it('renders RAG product indexing status and can reindex one product', async () => {
    const fetchMock = renderWithToken('/admin/rag');

    const panel = (await screen.findByRole('heading', { name: 'Sản phẩm' })).closest('section');
    expect(within(panel).getByText('Đã index')).toBeTruthy();
    expect(within(panel).getByText('Cần reindex')).toBeTruthy();
    fireEvent.change(within(panel).getByLabelText('ID sản phẩm'), { target: { value: '10' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Reindex sản phẩm' }));

    await screen.findByText('Đã reindex sản phẩm #10.');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/rag/products/10/reindex'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('renders the image embedding overview with all operational statuses and public model details', async () => {
    renderWithToken('/admin/rag');

    const panel = (await screen.findByRole('heading', { name: 'Embedding ảnh sản phẩm' })).closest('section');
    const statusCard = async (label) => (await within(panel).findByText(label)).closest('article');
    expect((await statusCard('Ảnh sản phẩm đang bán')).textContent).toContain('14');
    expect((await statusCard('Đã index')).textContent).toContain('10');
    expect((await statusCard('Chưa index')).textContent).toContain('1');
    expect((await statusCard('Cần reindex')).textContent).toContain('1');
    expect((await statusCard('Lỗi')).textContent).toContain('2');
    const details = within(panel).getByLabelText('Chi tiết embedding ảnh');
    expect(details.textContent).toContain('gemini-embedding-2 · 768 chiều');
    expect(details.textContent).toContain('Index gần nhất:');
  });

  it('disables global image reindex while running and reports returned counts', async () => {
    let finishReindex;
    imageReindexAllHandler = () => new Promise((resolve) => {
      finishReindex = () => resolve(jsonResponse({ summary: { indexed: 11, failed: 3 } }));
    });
    const fetchMock = renderWithToken('/admin/rag');
    const button = await screen.findByRole('button', { name: 'Reindex toàn bộ ảnh' });

    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Đang reindex ảnh...');
    finishReindex();

    expect(await screen.findByText('Đã reindex ảnh: 11 thành công, 3 lỗi.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/rag/images/reindex'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('keeps the policy RAG UI usable when the image overview fails', async () => {
    imageOverviewHandler = async () => jsonResponse(
      { message: 'Image indexing is temporarily unavailable' },
      false,
      'Service Unavailable'
    );
    renderWithToken('/admin/rag');

    expect(await screen.findByText('Image indexing is temporarily unavailable')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tổng quan tri thức' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Chính sách' })).toBeTruthy();
    expect(screen.getByText('Chính sách đổi trả')).toBeTruthy();
  });

  it('reindexes image embeddings for the selected product ID and surfaces failures safely', async () => {
    const fetchMock = renderWithToken('/admin/rag');
    const panel = (await screen.findByRole('heading', { name: 'Embedding ảnh sản phẩm' })).closest('section');
    fireEvent.change(within(panel).getByLabelText('ID sản phẩm'), { target: { value: '10' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Reindex ảnh sản phẩm' }));

    expect(await screen.findByText('Đã reindex ảnh sản phẩm #10: 2 thành công, 1 lỗi.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/rag/products/10/image-reindex'),
      expect.objectContaining({ method: 'POST' })
    );

    imageReindexProductHandler = async () => jsonResponse(
      { message: 'Image indexing is temporarily unavailable' },
      false,
      'Service Unavailable'
    );
    fireEvent.click(within(panel).getByRole('button', { name: 'Reindex ảnh sản phẩm' }));
    expect(await screen.findByText('Image indexing is temporarily unavailable')).toBeTruthy();
  });

  it('renders product admin table', async () => {
    renderWithToken('/admin/products');

    const table = await screen.findByRole('table', { name: 'Sản phẩm quản trị' });
    expect(await within(table).findByText('Road Runner 1')).toBeTruthy();
    expect(within(table).getByText('Đang bán')).toBeTruthy();
    expect(within(table).getByText(/1\.890\.000\s*₫/)).toBeTruthy();
    expect(within(table).getByText('8 đôi')).toBeTruthy();
  });

  it('submits product create form', async () => {
    const fetchMock = renderWithToken('/admin/products/new');

    await screen.findByRole('heading', { name: 'Tạo sản phẩm' });
    await screen.findByRole('option', { name: 'Lifestyle' });
    fireEvent.change(screen.getByLabelText('Tên sản phẩm'), { target: { value: 'Court Classic Low' } });
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Low profile court shoe' } });
    fireEvent.change(screen.getByLabelText('Thương hiệu'), { target: { value: 'Stride' } });
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'Lifestyle' } });
    fireEvent.change(screen.getByLabelText('Giới tính'), { target: { value: 'unisex' } });
    fireEvent.change(screen.getByLabelText('Giá'), { target: { value: '1490000' } });
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
          price: 1490000,
          status: 'active',
          featured: true
        })
      })
    );
  });

  it('renders and updates existing variants on the product edit form', async () => {
    const fetchMock = renderWithToken('/admin/products/10/edit');

    const variantsTable = await screen.findByRole('table', { name: 'Phiên bản sản phẩm' });
    expect(within(variantsTable).getByRole('columnheader', { name: '% giảm giá' })).toBeTruthy();
    const newVariantDiscount = screen.getByLabelText('% giảm giá');
    expect(newVariantDiscount.min).toBe('0');
    expect(newVariantDiscount.max).toBe('100');
    expect(newVariantDiscount.step).toBe('0.01');
    const variantRow = within(variantsTable).getByDisplayValue('RR1-9-BLK').closest('tr');
    fireEvent.change(within(variantRow).getByLabelText('Tồn kho cho RR1-9-BLK'), { target: { value: '9' } });
    fireEvent.change(within(variantRow).getByLabelText('% giảm giá cho RR1-9-BLK'), { target: { value: '12.5' } });
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
          discountPercent: 12.5
        })
      })
    );
  });

  it('omits untouched discount on stock saves but sends an intentional reset to zero', async () => {
    const fetchMock = renderWithToken('/admin/products/10/edit');
    const stock = await screen.findByLabelText('Tồn kho cho RR1-9-BLK');
    const discount = screen.getByLabelText('% giảm giá cho RR1-9-BLK');
    const save = screen.getByRole('button', { name: 'Lưu RR1-9-BLK' });
    const savedBodies = () => fetchMock.mock.calls
      .filter(([url, options]) => String(url).endsWith('/api/admin/variants/101') && options.method === 'PATCH')
      .map(([, options]) => JSON.parse(options.body));
    fireEvent.change(stock, { target: { value: '9' } });
    fireEvent.click(save);
    await screen.findByText('Đã lưu phiên bản.');
    expect(savedBodies()[0].stockQuantity).toBe(9);
    expect(savedBodies()[0]).not.toHaveProperty('discountPercent');
    // Editing away and back to the displayed zero is an explicit pricing decision.
    fireEvent.change(discount, { target: { value: '10' } });
    fireEvent.change(discount, { target: { value: '0' } });
    fireEvent.click(save);
    await screen.findByText('Đã lưu phiên bản.');
    expect(savedBodies()[1].discountPercent).toBe(0);
    fireEvent.change(stock, { target: { value: '8' } });
    fireEvent.click(save);
    await screen.findByText('Đã lưu phiên bản.');
    expect(savedBodies()[2]).not.toHaveProperty('discountPercent');
  });

  it('renders admin order list', async () => {
    renderWithToken('/admin/orders');

    const table = await screen.findByRole('table', { name: 'Đơn hàng quản trị' });
    const orderRow = within(table).getByText('ORD-20260905-ABC123').closest('tr');
    expect(within(orderRow).getByText('customer@shoestore.local')).toBeTruthy();
    expect(within(orderRow).getByText(/1\.890\.000\s*₫/)).toBeTruthy();
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
