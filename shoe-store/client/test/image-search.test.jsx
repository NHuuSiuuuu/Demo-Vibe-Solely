import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { apiClient } from '../src/api/client.js';

const catalogProduct = {
  id: 1,
  slug: 'catalog-shoe',
  name: 'Giày catalog',
  brand: 'Solely',
  category: 'running',
  gender: 'unisex',
  price: 1200000,
  availableSizes: ['39'],
  totalStock: 4
};

const imageProduct = {
  ...catalogProduct,
  id: 2,
  slug: 'image-shoe',
  name: 'Giày tương tự từ ảnh'
};

function response(payload, ok = true) {
  return {
    ok,
    statusText: ok ? 'OK' : 'Service Unavailable',
    text: async () => JSON.stringify(payload)
  };
}

function renderCatalog(searchByImage = async () => response({ products: [imageProduct] })) {
  localStorage.setItem('shoe_store_token', 'customer-token');
  window.history.pushState({}, '', '/products');
  const fetchMock = vi.fn(async (url, options = {}) => {
    const path = new URL(String(url)).pathname;
    if (path === '/api/auth/me') {
      return response({ user: { id: 1, role: 'customer', name: 'Khách hàng' } });
    }
    if (path === '/api/cart') {
      return response({ cart: { items: [], subtotal: 0 } });
    }
    if (path === '/api/products/search-by-image') {
      return searchByImage(url, options);
    }
    if (path === '/api/products') {
      return response({ products: [catalogProduct] });
    }
    return response({});
  });
  global.fetch = fetchMock;
  render(<App />);
  return fetchMock;
}

describe('customer image search', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('postForm sends multipart data with auth and no JSON content type', async () => {
    const formData = new FormData();
    formData.append('image', new File(['shoe'], 'shoe.jpg', { type: 'image/jpeg' }));
    global.fetch = vi.fn(async () => response({ products: [] }));

    await apiClient.postForm('/api/products/search-by-image', formData, { token: 'secret-token' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/products/search-by-image'),
      expect.objectContaining({
        method: 'POST',
        body: formData,
        headers: { Authorization: 'Bearer secret-token' }
      })
    );
  });

  it('opens an accessible camera input, preserves filters, and renders loading and results', async () => {
    let finishSearch;
    const imageResponse = new Promise((resolve) => {
      finishSearch = resolve;
    });
    const fetchMock = renderCatalog(() => imageResponse);
    expect(await screen.findByRole('heading', { name: catalogProduct.name })).toBeTruthy();

    const cameraButton = screen.getByRole('button', { name: 'Tìm sản phẩm bằng hình ảnh' });
    const fileInput = screen.getByLabelText('Chọn ảnh để tìm sản phẩm');
    expect(fileInput.getAttribute('accept')).toBe('image/jpeg,image/png');
    expect(fileInput.getAttribute('capture')).toBe('environment');
    fireEvent.click(cameraButton);
    fireEvent.change(screen.getByLabelText('Thương hiệu'), { target: { value: 'Solely' } });
    fireEvent.change(fileInput, {
      target: { files: [new File(['shoe'], 'shoe.png', { type: 'image/png' })] }
    });

    expect(
      (await screen.findByRole('status', { name: 'Trạng thái tìm kiếm bằng ảnh' })).textContent
    ).toContain('Đang tìm sản phẩm tương tự');
    const imageCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/products/search-by-image'));
    expect(imageCall[1].body).toBeInstanceOf(FormData);
    expect(imageCall[1].body.get('image').name).toBe('shoe.png');
    expect(imageCall[1].body.get('brand')).toBe('Solely');
    expect(imageCall[1].headers['Content-Type']).toBeUndefined();

    finishSearch(response({ products: [imageProduct], query: { type: 'image' }, threshold: 0.35 }));
    expect(await screen.findByRole('heading', { name: imageProduct.name })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ảnh dùng để tìm sản phẩm' }).getAttribute('src')).toBe('blob:preview');
  });

  it('shows provider errors, retries, empty results, and restores the filtered catalog when cleared', async () => {
    let attempts = 0;
    const fetchMock = renderCatalog(async () => {
      attempts += 1;
      if (attempts === 1) {
        return response({ error: { message: 'Không thể tìm bằng ảnh lúc này.' } }, false);
      }
      return response({ products: [] });
    });
    expect(await screen.findByRole('heading', { name: catalogProduct.name })).toBeTruthy();
    const fileInput = screen.getByLabelText('Chọn ảnh để tìm sản phẩm');
    fireEvent.change(fileInput, {
      target: { files: [new File(['shoe'], 'shoe.jpg', { type: 'image/jpeg' })] }
    });

    expect((await screen.findByRole('alert')).textContent).toContain('Không thể tìm bằng ảnh lúc này.');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại tìm kiếm bằng ảnh' }));
    expect(await screen.findByText('Không tìm thấy sản phẩm tương tự.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa ảnh tìm kiếm' }));
    expect(await screen.findByRole('heading', { name: catalogProduct.name })).toBeTruthy();
    await waitFor(() => {
      const catalogCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/products?'));
      expect(catalogCalls.at(-1)[0]).toContain('sort=newest');
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it.each([
    [new File(['text'], 'shoe.gif', { type: 'image/gif' }), 'Chỉ chấp nhận ảnh JPEG hoặc PNG.'],
    [new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }), 'Ảnh không được vượt quá 8 MB.']
  ])('rejects invalid image files before uploading', async (file, message) => {
    const fetchMock = renderCatalog();
    expect(await screen.findByRole('heading', { name: catalogProduct.name })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Chọn ảnh để tìm sản phẩm'), { target: { files: [file] } });

    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/products/search-by-image'))).toBe(false);
  });
});
