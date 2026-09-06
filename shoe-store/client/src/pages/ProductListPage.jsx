import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';

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
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    category: searchParams.get('category') || '',
    sort: searchParams.get('sort') || initialFilters.sort
  }));
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, [filters]);

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateCategory(category) {
    setFilters((current) => ({ ...current, category }));
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

      <form className="filter-bar">
        <label>
          Tìm sản phẩm
          <input name="q" type="search" value={filters.q} onChange={updateFilter} />
        </label>
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

      {status === 'error' ? <p className="form-error">{error}</p> : null}
      {status === 'loading' ? <p className="muted">Đang tải sản phẩm...</p> : null}
      {status === 'ready' && visibleProducts.length === 0 ? <p className="muted">Không có sản phẩm phù hợp.</p> : null}
      <div className="product-grid">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export { buildProductQuery };
