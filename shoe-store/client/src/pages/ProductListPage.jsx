import { Camera, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const IMAGE_FILTER_FIELDS = ['brand', 'gender', 'size', 'color', 'minPrice', 'maxPrice'];

const initialImageSearch = {
  file: null,
  previewUrl: '',
  status: 'idle',
  error: ''
};

const initialFilters = {
  q: '',
  brand: '',
  gender: '',
  size: '',
  color: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest'
};

const categoryFilters = [
  { label: 'Tất cả', value: '' },
  { label: 'Hằng ngày', value: 'everyday' },
  { label: 'Chạy bộ', value: 'running' },
  { label: 'Sân đấu', value: 'court' }
];

function buildProductQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `/api/products?${query}` : '/api/products';
}

export default function ProductListPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    category: searchParams.get('category') || '',
    sort: searchParams.get('sort') || initialFilters.sort
  }));
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [imageSearch, setImageSearch] = useState(initialImageSearch);
  const fileInputRef = useRef(null);
  const imageRequestIdRef = useRef(0);

  useEffect(() => {
    if (imageSearch.file) {
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setError('');

    apiClient
      .get(buildProductQuery(filters))
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products || []);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setProducts([]);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters, imageSearch.file]);

  useEffect(() => {
    const previewUrl = imageSearch.previewUrl;
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [imageSearch.previewUrl]);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateCategory(category) {
    setFilters((current) => ({ ...current, category }));
  }

  async function searchByImage(file) {
    const requestId = imageRequestIdRef.current + 1;
    imageRequestIdRef.current = requestId;
    setImageSearch((current) => ({ ...current, file, status: 'loading', error: '' }));

    const formData = new FormData();
    formData.append('image', file);
    IMAGE_FILTER_FIELDS.forEach((field) => {
      if (filters[field]) {
        formData.append(field, filters[field]);
      }
    });

    try {
      const data = await apiClient.postForm(
        '/api/products/search-by-image',
        formData,
        token ? { token } : {}
      );
      if (imageRequestIdRef.current !== requestId) {
        return;
      }
      setProducts(data?.products || []);
      setImageSearch((current) => ({ ...current, status: 'ready', error: '' }));
    } catch (requestError) {
      if (imageRequestIdRef.current !== requestId) {
        return;
      }
      setImageSearch((current) => ({ ...current, status: 'error', error: requestError.message }));
    }
  }

  function selectImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setImageSearch((current) => ({ ...current, status: 'error', error: 'Chỉ chấp nhận ảnh JPEG hoặc PNG.' }));
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageSearch((current) => ({ ...current, status: 'error', error: 'Ảnh không được vượt quá 8 MB.' }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImageSearch({ file, previewUrl, status: 'loading', error: '' });
    searchByImage(file);
  }

  function clearImageSearch() {
    imageRequestIdRef.current += 1;
    setProducts([]);
    setImageSearch(initialImageSearch);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const visibleProducts = useMemo(() => {
    if (!filters.category || ['running', 'sneakers', 'lifestyle'].includes(filters.category)) {
      return products;
    }

    const categoryMap = {
      everyday: ['walking', 'training', 'sneakers', 'boots'],
      court: ['sneakers', 'training']
    };

    return products.filter((product) => categoryMap[filters.category]?.includes(String(product.category).toLowerCase()));
  }, [filters.category, products]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      category: searchParams.get('category') || '',
      sort: searchParams.get('sort') || initialFilters.sort
    }));
  }, [searchParams]);

  return (
    <section className="shop-page" aria-labelledby="products-title">
      <div className="section-heading products-heading">
        <div>
          <p className="eyebrow">CỬA HÀNG</p>
          <h1 id="products-title">Đôi giày tiếp theo của bạn</h1>
          <p>Chọn sneaker theo phong cách, cảm giác mang và ngân sách của bạn.</p>
        </div>
      </div>

      <div className="category-pills" aria-label="Lọc danh mục sản phẩm">
        {categoryFilters.map((filter) => (
          <button
            type="button"
            className={filters.category === filter.value ? 'is-active' : ''}
            key={filter.value || 'all'}
            onClick={() => updateCategory(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <div className="image-search-field">
          <label htmlFor="product-query">Tìm sản phẩm</label>
          <div className="image-search-field__control">
            <input id="product-query" name="q" type="search" value={filters.q} onChange={updateFilter} />
            <button
              type="button"
              className="image-search-field__camera"
              aria-label="Tìm sản phẩm bằng hình ảnh"
              disabled={imageSearch.status === 'loading'}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={20} aria-hidden="true" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            className="image-search-field__input"
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            aria-label="Chọn ảnh để tìm sản phẩm"
            onChange={selectImage}
          />
        </div>
        <label>
          Thương hiệu
          <input name="brand" value={filters.brand} onChange={updateFilter} />
        </label>
        <label>
          Giới tính
          <select name="gender" value={filters.gender} onChange={updateFilter}>
            <option value="">Tất cả</option>
            <option value="men">Nam</option>
            <option value="women">Nữ</option>
            <option value="unisex">Unisex</option>
          </select>
        </label>
        <label>
          Size
          <input name="size" value={filters.size} onChange={updateFilter} />
        </label>
        <label>
          Màu
          <input name="color" value={filters.color} onChange={updateFilter} />
        </label>
        <label>
          Giá thấp nhất
          <input name="minPrice" type="number" min="0" value={filters.minPrice} onChange={updateFilter} />
        </label>
        <label>
          Giá cao nhất
          <input name="maxPrice" type="number" min="0" value={filters.maxPrice} onChange={updateFilter} />
        </label>
        <label>
          Sắp xếp
          <select name="sort" value={filters.sort} onChange={updateFilter}>
            <option value="newest">Mới nhất</option>
            <option value="price_asc">Giá thấp đến cao</option>
            <option value="price_desc">Giá cao đến thấp</option>
            <option value="name_asc">Tên A-Z</option>
          </select>
        </label>
      </form>

      {imageSearch.file ? (
        <div className="image-search-preview">
          <img src={imageSearch.previewUrl} alt="Ảnh dùng để tìm sản phẩm" />
          <div className="image-search-preview__details">
            <strong>{imageSearch.file.name}</strong>
            {imageSearch.status === 'loading' ? (
              <p className="image-search-status" role="status" aria-label="Trạng thái tìm kiếm bằng ảnh">
                Đang tìm sản phẩm tương tự...
              </p>
            ) : null}
            {imageSearch.status === 'error' ? (
              <p className="form-error" role="alert">{imageSearch.error}</p>
            ) : null}
            {imageSearch.status === 'ready' && visibleProducts.length === 0 ? (
              <p className="muted">Không tìm thấy sản phẩm tương tự.</p>
            ) : null}
            <div className="image-search-preview__actions">
              {imageSearch.status === 'error' ? (
                <button
                  type="button"
                  className="button-secondary"
                  aria-label="Thử lại tìm kiếm bằng ảnh"
                  onClick={() => searchByImage(imageSearch.file)}
                >
                  <RefreshCw size={17} aria-hidden="true" />
                  Thử lại
                </button>
              ) : null}
              <button
                type="button"
                className="button-secondary"
                aria-label="Xóa ảnh tìm kiếm"
                onClick={clearImageSearch}
              >
                <X size={17} aria-hidden="true" />
                Xóa ảnh
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!imageSearch.file && imageSearch.status === 'error' ? (
        <p className="form-error" role="alert">{imageSearch.error}</p>
      ) : null}
      {!imageSearch.file && status === 'error' ? <p className="form-error">{error}</p> : null}
      {!imageSearch.file && status === 'loading' ? <p className="muted">Đang tải sản phẩm...</p> : null}
      {!imageSearch.file && status === 'ready' && visibleProducts.length === 0 ? (
        <p className="muted">Không có sản phẩm phù hợp.</p>
      ) : null}
      <div className="product-grid">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export { buildProductQuery };
