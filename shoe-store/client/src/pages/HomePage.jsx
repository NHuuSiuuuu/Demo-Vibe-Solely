import { Headphones, ShieldCheck, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import ExpandableProductGallery from '../components/ExpandableProductGallery.jsx';
import ImageStreamHero from '../components/ImageStreamHero.jsx';
import ProductCard, { formatMoney } from '../components/ProductCard.jsx';

const FALLBACK_EDITORIAL_IMAGES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80'
];

const journalPosts = [
  {
    date: '06.09.2026',
    title: 'Cách chọn sneaker tối giản cho cả tuần làm việc',
    image: FALLBACK_EDITORIAL_IMAGES[1]
  },
  {
    date: '02.09.2026',
    title: 'Ba chi tiết làm nên một đôi giày êm mỗi ngày',
    image: FALLBACK_EDITORIAL_IMAGES[2]
  },
  {
    date: '28.08.2026',
    title: 'Phối sneaker trắng gọn gàng mà không nhàm chán',
    image: FALLBACK_EDITORIAL_IMAGES[4]
  }
];

function productImage(products, index) {
  return products[index]?.imageUrl || FALLBACK_EDITORIAL_IMAGES[index % FALLBACK_EDITORIAL_IMAGES.length];
}

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const streamImages = useMemo(
    () =>
      Array.from({ length: Math.max(products.length, FALLBACK_EDITORIAL_IMAGES.length) }, (_, index) => ({
        src: productImage(products, index),
        alt: products[index]?.name || `Sneaker Solely ${index + 1}`
      })),
    [products]
  );
  const arrivals = products.slice(0, 4);
  const saleProduct = products[0];

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/api/products?sort=newest')
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="home-page editorial-storefront" aria-label="Trang chủ Solely">
      <section className="editorial-hero" aria-label="Bộ sưu tập nổi bật">
        <ImageStreamHero className="editorial-hero__stream" images={streamImages} cards={12} speed={18} axis={55}>
          <div className="editorial-hero__overlay">
            <div className="editorial-hero__headline">
              <p className="eyebrow">BỘ SƯU TẬP / 2026</p>
              <h1 id="home-title">Tất cả điểm nhấn mới cho tủ giày của bạn</h1>
            </div>
            <div className="editorial-hero__support">
              <p>Sneaker Solely tối giản, êm nhẹ và đủ chỉn chu cho nhịp sống Việt mỗi ngày.</p>
              <Link className="button-secondary editorial-hero__cta" to="/products">
                Xem thêm
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </ImageStreamHero>
      </section>

      <section className="editorial-section" aria-labelledby="new-arrivals-title">
        <div className="editorial-heading">
          <p className="eyebrow">SẢN PHẨM MỚI</p>
          <h2 id="new-arrivals-title">Hàng mới về</h2>
          <p>Những mẫu sneaker được chọn cho chuyển động hằng ngày, dễ phối và dễ mang.</p>
        </div>
        <div className="product-grid editorial-product-grid">
          {arrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <Link className="button-secondary centered-action" to="/products?sort=newest">
          Xem thêm
        </Link>
      </section>

      <section className="promo-countdown" aria-labelledby="promo-title">
        <div>
          <p className="eyebrow">TIN MỚI VÀ CẢM HỨNG</p>
          <h2 id="promo-title">Ưu đãi cuối tuần</h2>
          <span className="accent-rule" aria-hidden="true" />
          <div className="countdown-grid" aria-label="Đếm ngược ưu đãi">
            <span>
              <strong>02</strong>
              Ngày
            </span>
            <span>
              <strong>14</strong>
              Giờ
            </span>
            <span>
              <strong>36</strong>
              Phút
            </span>
            <span>
              <strong>09</strong>
              Giây
            </span>
          </div>
          <p className="promo-price">
            <del>{formatMoney(Number(saleProduct?.price || 1890000) + 400000)}</del>
            <strong>{formatMoney(saleProduct?.price || 1890000)}</strong>
          </p>
        </div>
        <div className="promo-image">
          <img src={productImage(products, 0)} alt={saleProduct?.name || 'Sneaker Solely trong ưu đãi'} />
        </div>
      </section>

      <section className="editorial-section" aria-labelledby="top-selling-title">
        <div className="editorial-heading">
          <p className="eyebrow">BÁN CHẠY</p>
          <h2 id="top-selling-title">Sản phẩm bán chạy</h2>
          <p>Các nhóm sản phẩm nổi bật được sắp xếp theo kiểu editorial để khách hàng quét nhanh.</p>
        </div>
        <ExpandableProductGallery products={products.slice(0, 5)} />
      </section>

      <div className="trust-badges" aria-label="Cam kết dịch vụ">
        <article>
          <Truck size={22} aria-hidden="true" />
          <strong>Miễn phí giao hàng</strong>
          <span>Áp dụng cho đơn từ 1.500.000 ₫</span>
        </article>
        <article>
          <Headphones size={22} aria-hidden="true" />
          <strong>Hỗ trợ 24/7</strong>
          <span>Tư vấn size và đơn hàng nhanh chóng</span>
        </article>
        <article>
          <ShieldCheck size={22} aria-hidden="true" />
          <strong>Hoàn tiền 100%</strong>
          <span>Đổi trả minh bạch trong 30 ngày</span>
        </article>
      </div>

      <section className="editorial-section" aria-labelledby="journal-title">
        <div className="editorial-heading">
          <p className="eyebrow">BLOG</p>
          <h2 id="journal-title">Từ Solely Journal</h2>
          <p>Câu chuyện ngắn về chất liệu, phối đồ và cách chăm sóc sneaker.</p>
        </div>
        <div className="journal-grid">
          {journalPosts.map((post) => (
            <article className="journal-card" key={post.title}>
              <img src={post.image} alt={post.title} />
              <time>{post.date}</time>
              <h3>{post.title}</h3>
              <Link to="/products">Đọc thêm</Link>
            </article>
          ))}
        </div>
        <Link className="button-secondary centered-action" to="/products">
          Xem thêm
        </Link>
      </section>

      <section className="instagram-strip" aria-labelledby="instagram-title">
        <h2 id="instagram-title">Theo dõi Solely trên Instagram</h2>
        <div>
          {Array.from({ length: 6 }, (_, index) => (
            <img key={index} src={productImage(products, index)} alt={`Khoảnh khắc Solely ${index + 1}`} />
          ))}
        </div>
      </section>
    </section>
  );
}
