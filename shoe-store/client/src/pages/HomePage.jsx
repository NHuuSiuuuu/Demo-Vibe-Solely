import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const heroProduct = products[0];

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/api/products?sort=newest')
      .then((data) => {
        if (!cancelled) {
          setProducts((data.products || []).slice(0, 4));
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
    <section className="home-page" aria-labelledby="home-title">
      <div className="commerce-hero">
        <div className="hero-copy">
          <p className="eyebrow">BỘ SƯU TẬP MỚI / 2024</p>
          <h1 id="home-title">Di chuyển thật đẹp.</h1>
          <p>Giày sneaker nhẹ, êm và tinh gọn cho chuyển động mỗi ngày.</p>
          <div className="hero-actions">
            <Link className="button-link" to="/products?sort=newest">
              Mua hàng mới
            </Link>
            <Link className="button-secondary" to="/products">
              Khám phá bộ sưu tập
            </Link>
          </div>
        </div>
        <div className="hero-product" aria-label="Ảnh sản phẩm sneaker nổi bật">
          {heroProduct?.imageUrl ? <img src={heroProduct.imageUrl} alt={heroProduct.name} /> : <div className="hero-shoe-fallback">Solely</div>}
        </div>
      </div>

      <div className="trust-bar" aria-label="Cam kết mua sắm">
        <article>
          <span aria-hidden="true">01</span>
          <strong>Miễn phí giao hàng từ $75</strong>
        </article>
        <article>
          <span aria-hidden="true">02</span>
          <strong>Đổi trả dễ dàng trong 30 ngày</strong>
        </article>
        <article>
          <span aria-hidden="true">03</span>
          <strong>Thiết kế cho chuyển động hằng ngày</strong>
        </article>
      </div>

      <section className="collection-section" aria-labelledby="collection-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BỘ SƯU TẬP</p>
            <h2 id="collection-title">Đôi giày tiếp theo của bạn</h2>
          </div>
          <Link className="text-link" to="/products">
            Xem tất cả
          </Link>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="feature-banner" id="materials" aria-labelledby="materials-title">
        <div>
          <p className="eyebrow">CHẤT LIỆU</p>
          <h2 id="materials-title">Sinh ra cho mỗi ngày.</h2>
          <p>Đệm êm, thân giày nhẹ, đế bền và độ linh hoạt vừa đủ để đồng hành từ buổi sáng đến cuối ngày.</p>
          <Link className="button-link" to="/products?category=sneakers">
            Tìm hiểu chất liệu
          </Link>
        </div>
        <div className="feature-image">
          {products[1]?.imageUrl ? <img src={products[1].imageUrl} alt={products[1].name} /> : null}
        </div>
      </section>

      <section className="story-section" id="story" aria-labelledby="story-title">
        <div className="story-image">
          {products[2]?.imageUrl ? <img src={products[2].imageUrl} alt={products[2].name} /> : null}
        </div>
        <div>
          <p className="eyebrow">CÂU CHUYỆN</p>
          <h2 id="story-title">Thiết kế tốt phải theo kịp bạn.</h2>
          <p>
            Solely theo đuổi sự tối giản có chủ đích: ít chi tiết thừa, nhiều thoải mái hơn, dễ phối đồ hơn và sẵn sàng
            cho mọi chuyển động thường ngày.
          </p>
          <Link className="button-secondary" to="/products">
            Câu chuyện Solely
          </Link>
        </div>
      </section>

      <section className="newsletter-section" id="newsletter" aria-labelledby="newsletter-title">
        <div>
          <p className="eyebrow">BẢN TIN</p>
          <h2 id="newsletter-title">Luôn chuyển động.</h2>
          <p>Nhận thông tin sớm về đợt ra mắt mới, câu chuyện sản phẩm và ưu đãi riêng.</p>
        </div>
        <form onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="newsletter-email">Email nhận bản tin</label>
          <div className="newsletter-control">
            <input id="newsletter-email" type="email" placeholder="you@example.com" required />
            <button type="submit">Đăng ký</button>
          </div>
        </form>
      </section>
    </section>
  );
}
