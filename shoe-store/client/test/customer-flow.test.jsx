import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    price: 120,
    imageUrl: '/images/road-runner-1-main.jpg',
    availableSizes: ['9', '10'],
    availableColors: ['black', 'white'],
    totalStock: 8
  },
  {
    id: 2,
    name: 'Court Classic',
    slug: 'court-classic',
    brand: 'Ace',
    category: 'Tennis',
    gender: 'women',
    price: 90,
    imageUrl: '/images/court-classic-main.jpg',
    availableSizes: ['7', '8'],
    availableColors: ['white', 'red'],
    totalStock: 4
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
    { id: 102, sku: 'RR1-10-WHT', size: '10', color: 'white', stockQuantity: 5, priceDelta: 10 }
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
      unitPrice: 120,
      lineTotal: 240
    }
  ],
  subtotal: 240
};

const order = {
  id: 900,
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
  subtotal: 240,
  shippingTotal: 0,
  taxTotal: 0,
  grandTotal: 240,
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
      unitPrice: 120,
      quantity: 2,
      lineTotal: 240
    }
  ]
};

function jsonResponse(payload, ok = true) {
  return {
    ok,
    statusText: ok ? 'OK' : 'Bad Request',
    text: async () => JSON.stringify(payload)
  };
}

function createFetchMock() {
  return vi.fn(async (url, options = {}) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname;

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
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders products from the API', async () => {
    renderAsCustomer('/products');

    expect(await screen.findByRole('heading', { name: 'Road Runner 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Court Classic' })).toBeTruthy();
    expect(screen.getByText('Stride')).toBeTruthy();
    expect(screen.getByText('Sizes: 9, 10')).toBeTruthy();
  });

  it('filters products by search keyword', async () => {
    const fetchMock = renderAsCustomer('/products');
    await screen.findByRole('heading', { name: 'Road Runner 1' });

    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'court' } });

    await screen.findByRole('heading', { name: 'Court Classic' });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Road Runner 1' })).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/products?q=court'), expect.any(Object));
  });

  it('adds a selected variant to cart', async () => {
    const fetchMock = renderAsCustomer('/products/road-runner-1');
    await screen.findByRole('heading', { name: 'Road Runner 1' });

    fireEvent.click(screen.getByLabelText('Size 9, color black'));
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    await screen.findByText('Added to cart.');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/cart/items'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ variantId: 101, quantity: 2 })
      })
    );
  });

  it('submits COD checkout', async () => {
    const fetchMock = renderAsCustomer('/checkout');
    await screen.findByText('Road Runner 1');

    fireEvent.change(screen.getByLabelText('Receiver name'), { target: { value: 'Jordan Miles' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText('Shipping address'), { target: { value: '1 Main St' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Austin' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'TX' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '78701' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Leave at door' } });
    fireEvent.click(screen.getByRole('button', { name: 'Place COD order' }));

    expect(await screen.findByRole('heading', { name: 'Order ORD-900' })).toBeTruthy();
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
            country: 'US'
          },
          note: 'Leave at door'
        })
      })
    );
  });

  it('renders order status tracking', async () => {
    renderAsCustomer('/orders/900');

    expect(await screen.findByRole('heading', { name: 'Order ORD-900' })).toBeTruthy();
    const timeline = screen.getByLabelText('Order status timeline');
    expect(within(timeline).getByText('pending')).toBeTruthy();
    expect(within(timeline).getByText('confirmed')).toBeTruthy();
    expect(within(timeline).getByText('shipping')).toBeTruthy();
    expect(within(timeline).getByText('completed')).toBeTruthy();
    expect(within(timeline).getByText('Current')).toBeTruthy();
    expect(screen.getByText('Payment: unpaid')).toBeTruthy();
  });

  it('shows AI product recommendations', async () => {
    renderAsCustomer('/products');
    await screen.findByRole('heading', { name: 'Road Runner 1' });

    fireEvent.click(screen.getByRole('button', { name: 'Open shopping assistant' }));
    fireEvent.change(screen.getByLabelText('Ask for product advice'), {
      target: { value: 'running shoes size 9' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send advice request' }));

    expect(await screen.findByText('Gợi ý phù hợp cho bạn: Road Runner 1.')).toBeTruthy();
    expect(screen.getByText('Recommended products')).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'Road Runner 1' }).length).toBeGreaterThan(1);
  });

  it('shows login/register guidance on logged-out checkout without calling protected APIs', () => {
    const fetchMock = renderLoggedOut('/checkout');
    const authPrompt = screen.getByRole('region', { name: 'Login to continue' });

    expect(within(authPrompt).getByRole('heading', { name: 'Login to continue' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Login' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Register' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Place COD order' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/orders'), expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/cart'), expect.any(Object));
  });

  it('shows login/register guidance on logged-out orders without calling protected APIs', () => {
    const fetchMock = renderLoggedOut('/orders');
    const authPrompt = screen.getByRole('region', { name: 'Login to continue' });

    expect(within(authPrompt).getByRole('heading', { name: 'Login to continue' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Login' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Register' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/orders'), expect.any(Object));
  });

  it('shows login/register guidance on logged-out order detail without calling protected APIs', () => {
    const fetchMock = renderLoggedOut('/orders/900');
    const authPrompt = screen.getByRole('region', { name: 'Login to continue' });

    expect(within(authPrompt).getByRole('heading', { name: 'Login to continue' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Login' })).toBeTruthy();
    expect(within(authPrompt).getByRole('link', { name: 'Register' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/orders/900'), expect.any(Object));
  });
});
