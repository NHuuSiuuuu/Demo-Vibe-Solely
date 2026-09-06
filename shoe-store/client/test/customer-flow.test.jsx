import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const products = [
  {
    id: 1,
    name: 'Road Runner 1',
    slug: 'road-runner-1',
    brand: 'Stride',
    category: 'Running',
    gender: 'men',
    price: 1200000,
    imageUrl: '/images/road-runner-1-main.jpg',
    availableSizes: ['9', '10'],
    availableColors: ['black', 'white'],
    totalStock: 8,
    defaultVariantId: 101,
    defaultVariantStock: 3
  },
  {
    id: 2,
    name: 'Court Classic',
    slug: 'court-classic',
    brand: 'Ace',
    category: 'Tennis',
    gender: 'women',
    price: 900000,
    imageUrl: '/images/court-classic-main.jpg',
    availableSizes: ['7', '8'],
    availableColors: ['white', 'red'],
    totalStock: 4,
    defaultVariantId: 201,
    defaultVariantStock: 4
  }
];

const productDetail = {
  ...products[0],
  description: 'Daily running shoe with cushioned support.',
  images: [
    { id: 11, imageUrl: '/images/road-runner-1-main.jpg', altText: 'Road Runner 1 side view', sortOrder: 0 },
    { id: 12, imageUrl: '/images/road-runner-1-sole.jpg', altText: 'Road Runner 1 sole', sortOrder: 1 }
  ],
  variants: [
    { id: 101, sku: 'RR1-9-BLK', size: '9', color: 'black', stockQuantity: 3, priceDelta: 0 },
    { id: 102, sku: 'RR1-10-WHT', size: '10', color: 'white', stockQuantity: 5, priceDelta: 100000 }
  ]
};

const cartWithItem = {
  id: 33,
  items: [
    {
      id: 501,
      variantId: 101,
      productId: 1,
      productName: 'Road Runner 1',
      sku: 'RR1-9-BLK',
      size: '9',
      color: 'black',
      quantity: 2,
      stockQuantity: 3,
      unitPrice: 1200000,
      lineTotal: 2400000
    }
  ],
  subtotal: 2400000
};

const order = {
  id: 900,
  orderCode: 'ORD-20260905-ABC123',
  userId: 1,
  customerEmail: 'customer@example.com',
  customerName: 'Jordan Miles',
  shippingAddress: {
    line1: '1 Main St',
    line2: '',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US'
  },
  subtotal: 2400000,
  shippingTotal: 0,
  taxTotal: 0,
  grandTotal: 2400000,
  note: 'Leave at door',
  orderStatus: 'shipping',
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  createdAt: '2026-09-05T10:00:00.000Z',
  items: [
    {
      id: 700,
      productId: 1,
      variantId: 101,
      productName: 'Road Runner 1',
      sku: 'RR1-9-BLK',
      size: '9',
      color: 'black',
      unitPrice: 1200000,
      quantity: 2,
      lineTotal: 2400000
    }
  ]
};

let apiOverrides = new Map();

function jsonResponse(payload, ok = true) {
  return {
    ok,
    statusText: ok ? 'OK' : 'Bad Request',
    text: async () => JSON.stringify(payload)
  };
}

function mockApi(path, payload) {
  apiOverrides.set(path, payload);
}

function createFetchMock() {
  return vi.fn(async (url, options = {}) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname;

    if (apiOverrides.has(path)) {
      return jsonResponse(apiOverrides.get(path));
    }

    if (path === '/api/auth/me') {
      return jsonResponse({
        user: { id: 1, email: 'customer@example.com', name: 'Customer User', role: 'customer' }
      });
    }

    if (path === '/api/products/road-runner-1') {
      return jsonResponse({ product: productDetail });
    }

    if (path === '/api/products') {
      const query = parsed.searchParams.get('q')?.toLowerCase();
      const matchingProducts = query
        ? products.filter((product) => product.name.toLowerCase().includes(query) || product.brand.toLowerCase().includes(query))
        : products;
      return jsonResponse({ products: matchingProducts });
    }

    if (path === '/api/cart' && (!options.method || options.method === 'GET')) {
      return jsonResponse({ cart: cartWithItem });
    }

    if (path === '/api/cart/items' && options.method === 'POST') {
      return jsonResponse({ cart: cartWithItem });
    }

    if (path === '/api/orders' && options.method === 'POST') {
      return jsonResponse({ order });
    }

    if (path === '/api/orders' && (!options.method || options.method === 'GET')) {
      return jsonResponse({ orders: [order] });
    }

    if (path === '/api/orders/900') {
      return jsonResponse({ order });
    }

    if (path === '/api/ai/chat') {
      return jsonResponse({
        answer: 'Gợi ý phù hợp cho bạn: Road Runner 1.',
        products: [products[0]]
      });
    }

    return jsonResponse({ cart: { items: [], subtotal: 0 } });
  });
}

function renderAsCustomer(path = '/') {
  localStorage.setItem('shoe_store_token', 'customer-token');
  window.history.pushState({}, '', path);
  const fetchMock = createFetchMock();
  global.fetch = fetchMock;
  render(<App />);
  return fetchMock;
}

function renderCustomerHome() {
  return renderAsCustomer('/');
}

async function askAssistant(question) {
  fireEvent.click(screen.getByRole('button', { name: 'Mở trợ lý mua sắm' }));
  const advisorInput = await screen.findByLabelText('Nhập câu hỏi tư vấn sản phẩm');

  fireEvent.change(advisorInput, {
    target: { value: question }
  });
  fireEvent.keyDown(advisorInput, { key: 'Enter', code: 'Enter' });
}

function renderLoggedOut(path) {
  window.history.pushState({}, '', path);
  const fetchMock = createFetchMock();
  global.fetch = fetchMock;
  render(<App />);
  return fetchMock;
}

describe('customer shopping flow', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn();
    apiOverrides = new Map();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the editorial storefront sections without legacy slide controls', async () => {
    renderAsCustomer('/');

    expect(await screen.findByRole('heading', { name: /Tất cả điểm nhấn mới/i })).toBeTruthy();
    const stream = screen.getByRole('img', { name: 'Hiệu ứng ảnh sneaker chuyển động' });
    expect(stream).toBeTruthy();
    expect(stream.querySelectorAll('.image-stream-card')).toHaveLength(24);
    expect(screen.queryByRole('button', { name: 'Slide trước' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Xem slide/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Slide tiếp theo' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Hàng mới về' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ưu đãi cuối tuần' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sản phẩm bán chạy' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Từ Solely Journal' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Theo dõi Solely trên Instagram' })).toBeTruthy();
  });

  it('renders products from the API', async () => {
    renderAsCustomer('/products');

    expect(await screen.findByRole('heading', { name: 'Road Runner 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Court Classic' })).toBeTruthy();
    expect(screen.getAllByText('Mới')[0].className).toContain('product-badge--themed');
    expect(screen.getAllByText('Chạy bộ').length).toBeGreaterThan(0);
    expect(screen.getByText('Size: 9, 10')).toBeTruthy();
  });

  it('filters products by search keyword', async () => {
    const fetchMock = renderAsCustomer('/products');
    await screen.findByRole('heading', { name: 'Road Runner 1' });

    fireEvent.change(screen.getByLabelText('Tìm sản phẩm'), { target: { value: 'court' } });

    await screen.findByRole('heading', { name: 'Court Classic' });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Road Runner 1' })).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/products?q=court'), expect.any(Object));
  });

  it('adds a selected variant to cart', async () => {
    const fetchMock = renderAsCustomer('/products/road-runner-1');
    await screen.findByRole('heading', { name: 'Road Runner 1' });
    expect(screen.getAllByText(/1\.200\.000\s*₫/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText(/Size 10, màu trắng, 1\.300\.000\s*₫/));
    expect(screen.getAllByText(/1\.300\.000\s*₫/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText(/Size 9, màu đen, 1\.200\.000\s*₫/));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Số lượng' }), { target: { value: '2' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm vào giỏ hàng' })[0]);

    await screen.findByRole('status', { name: 'Thông báo giỏ hàng' });
    expect(screen.getByText('Đã thêm vào giỏ hàng.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/cart/items'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ variantId: 101, quantity: 2 })
      })
    );
  });

  it('updates product detail quantity with stepper controls and buys now', async () => {
    const fetchMock = renderAsCustomer('/products/road-runner-1');
    await screen.findByRole('heading', { name: 'Road Runner 1' });

    expect(screen.getByRole('navigation', { name: 'Đường dẫn sản phẩm' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Đánh giá:' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Có thể bạn cũng thích' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    expect(screen.getByRole('spinbutton', { name: 'Số lượng' }).value).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Giảm số lượng' }));
    expect(screen.getByRole('spinbutton', { name: 'Số lượng' }).value).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Mua ngay' }));

    await screen.findByRole('status', { name: 'Thông báo giỏ hàng' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/cart/items'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ variantId: 101, quantity: 1 })
      })
    );
  });

  it('submits COD checkout', async () => {
    const fetchMock = renderAsCustomer('/checkout');
    await screen.findByText('Road Runner 1');

    fireEvent.change(screen.getByLabelText('Người nhận'), { target: { value: 'Jordan Miles' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText('Địa chỉ giao hàng'), { target: { value: '1 Main St' } });
    fireEvent.change(screen.getByLabelText('Tỉnh / thành phố'), { target: { value: 'Austin' } });
    fireEvent.change(screen.getByLabelText('Quận / huyện'), { target: { value: 'TX' } });
    fireEvent.change(screen.getByLabelText('Mã bưu chính'), { target: { value: '78701' } });
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Leave at door' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));

    expect(await screen.findByRole('heading', { name: 'Đơn hàng ORD-20260905-ABC123' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          receiverName: 'Jordan Miles',
          phone: '5551234567',
          shippingAddress: {
            line1: '1 Main St',
            line2: '',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
            country: 'Việt Nam'
          },
          note: 'Leave at door'
        })
      })
    );
  });

  it('renders order status tracking', async () => {
    renderAsCustomer('/orders/900');

    expect(await screen.findByRole('heading', { name: 'Đơn hàng ORD-20260905-ABC123' })).toBeTruthy();
    const timeline = screen.getByLabelText('Tiến trình trạng thái đơn hàng');
    expect(within(timeline).getByText('Chờ xác nhận')).toBeTruthy();
    expect(within(timeline).getByText('Đã xác nhận')).toBeTruthy();
    expect(within(timeline).getByText('Đang giao')).toBeTruthy();
    expect(within(timeline).getByText('Hoàn thành')).toBeTruthy();
    expect(within(timeline).getByText('Hiện tại')).toBeTruthy();
    expect(screen.getByText('Thanh toán: Chưa thanh toán')).toBeTruthy();
    expect(screen.getByText('Ghi chú: Leave at door')).toBeTruthy();
  });

  it('shows AI product recommendations', async () => {
    const fetchMock = renderAsCustomer('/products');
    await screen.findByRole('heading', { name: 'Road Runner 1' });
    const originalFetch = fetchMock.getMockImplementation();
    let resolveAiRequest;
    const aiRequest = new Promise((resolve) => {
      resolveAiRequest = () =>
        resolve(
          jsonResponse({
            answer: 'Gợi ý phù hợp cho bạn: Road Runner 1.',
            products: [products[0]]
          })
        );
    });
    fetchMock.mockImplementation((url, options = {}) => {
      const parsed = new URL(String(url));
      if (parsed.pathname === '/api/ai/chat') {
        return aiRequest;
      }
      return originalFetch(url, options);
    });

    const openAssistantButton = screen.getByRole('button', { name: 'Mở trợ lý mua sắm' });
    expect(openAssistantButton.textContent).toBe('');
    fireEvent.click(openAssistantButton);
    const messageLog = screen.getByRole('log', { name: 'Tin nhắn trợ lý mua sắm' });
    const closeAssistantButton = screen.getByRole('button', { name: 'Đóng trợ lý mua sắm' });
    expect(closeAssistantButton.className).toContain('ai-close-button--themed');
    const advisorInput = screen.getByLabelText('Nhập câu hỏi tư vấn sản phẩm');
    const sendButton = screen.getByRole('button', { name: 'Gửi yêu cầu tư vấn' });
    expect(sendButton.textContent).toBe('');

    fireEvent.change(advisorInput, {
      target: { value: 'running shoes size 9' }
    });
    fireEvent.keyDown(advisorInput, { key: 'Enter', code: 'Enter' });

    expect(within(messageLog).getByText('running shoes size 9')).toBeTruthy();
    expect(advisorInput.value).toBe('');
    expect(within(messageLog).getByRole('status', { name: 'Trợ lý đang trả lời' })).toBeTruthy();

    await act(async () => {
      resolveAiRequest();
      await aiRequest;
    });

    expect(await within(messageLog).findByText('Gợi ý phù hợp cho bạn: Road Runner 1.')).toBeTruthy();
    expect(within(messageLog).getByText('Sản phẩm gợi ý')).toBeTruthy();
    expect(within(messageLog).getByRole('heading', { name: 'Road Runner 1' })).toBeTruthy();
    const recommendations = within(messageLog).getByRole('region', { name: 'Sản phẩm gợi ý' });
    expect(recommendations.className).toContain('ai-recommendations--message');
    expect(messageLog.className).toContain('ai-message-log--hidden-scrollbar');
    expect(recommendations.closest('.ai-message-row--assistant')).toBeTruthy();
    expect(recommendations.querySelector('.ai-product-grid--mini')).toBeTruthy();
    expect(recommendations.querySelector('.ai-product-grid--static')).toBeTruthy();
    expect(within(recommendations).getByText(/1\.200\.000\s*₫/)).toBeTruthy();
    expect(within(recommendations).getByRole('img', { name: 'Road Runner 1' })).toBeTruthy();
    expect(within(recommendations).queryByText('Chạy bộ')).toBeNull();
    expect(within(recommendations).queryByText('Size: 9, 10')).toBeNull();
    expect(within(recommendations).queryByRole('button', { name: /Thêm vào giỏ hàng/i })).toBeNull();

    const assistantPanel = screen.getByRole('complementary', { name: 'Trợ lý mua sắm' }).querySelector('.ai-panel');
    expect(assistantPanel.lastElementChild.className).toContain('ai-form');
  });

  it('shows policy RAG answers without product recommendations', async () => {
    mockApi('/api/ai/chat', {
      answer: 'Solely hỗ trợ đổi trả theo điều kiện sản phẩm còn nguyên tem.',
      products: [],
      sources: [{ type: 'document', title: 'Đổi trả' }]
    });

    renderCustomerHome();
    await askAssistant('Shop đổi trả như thế nào?');

    expect(await screen.findByText(/hỗ trợ đổi trả/i)).toBeTruthy();
    expect(screen.queryByText('Sản phẩm gợi ý')).toBeNull();
  });

  it('shows login/register guidance on logged-out checkout without calling protected APIs', () => {
    const fetchMock = renderLoggedOut('/checkout');
    const authPrompt = screen.getByRole('region', { name: 'Đăng nhập để tiếp tục' });

    expect(within(authPrompt).getByRole('heading', { name: 'Đăng nhập để tiếp tục' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Đăng nhập' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Đăng ký' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Đặt hàng COD' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/orders'), expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/cart'), expect.any(Object));
  });

  it('shows login/register guidance on logged-out orders without calling protected APIs', () => {
    const fetchMock = renderLoggedOut('/orders');
    const authPrompt = screen.getByRole('region', { name: 'Đăng nhập để tiếp tục' });

    expect(within(authPrompt).getByRole('heading', { name: 'Đăng nhập để tiếp tục' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Đăng nhập' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Đăng ký' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/orders'), expect.any(Object));
  });

  it('shows login/register guidance on logged-out order detail without calling protected APIs', () => {
    const fetchMock = renderLoggedOut('/orders/900');
    const authPrompt = screen.getByRole('region', { name: 'Đăng nhập để tiếp tục' });

    expect(within(authPrompt).getByRole('heading', { name: 'Đăng nhập để tiếp tục' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Đăng nhập' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Đăng ký' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/orders/900'), expect.any(Object));
  });
});
