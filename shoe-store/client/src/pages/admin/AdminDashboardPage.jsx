import { useEffect, useState } from 'react';
import { Activity, Bell, DollarSign, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatMoney } from '../../components/ProductCard.jsx';
import { orderStatusLabel } from '../../utils/formatters.js';
import { formatOrderCode } from '../OrdersPage.jsx';

const emptyDashboard = {
  productsCount: 0,
  variantsCount: 0,
  ordersCount: 0,
  pendingOrdersCount: 0,
  completedRevenue: 0
};

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    Promise.all([
      apiClient.get('/api/admin/dashboard', { token }),
      apiClient.get('/api/admin/orders', { token }),
      apiClient.get('/api/admin/products', { token })
    ])
      .then(([dashboardData, ordersData, productsData]) => {
        if (!cancelled) {
          setDashboard(dashboardData.dashboard || emptyDashboard);
          setOrders(ordersData.orders || []);
          setProducts(productsData.products || []);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const hasOrderData = status === 'ready';
  const pendingOrdersCount = hasOrderData
    ? orders.filter((order) => order.orderStatus === 'pending').length
    : dashboard.pendingOrdersCount;
  const completedOrdersCount = orders.filter((order) => order.orderStatus === 'completed').length;
  const totalOrdersCount = hasOrderData ? orders.length : dashboard.ordersCount;
  const paidRevenue = orders
    .filter((order) => order.paymentStatus === 'paid')
    .reduce((total, order) => total + Number(order.grandTotal || 0), 0);
  const pendingRate = totalOrdersCount ? Math.round((pendingOrdersCount / totalOrdersCount) * 100) : 0;
  const completedRate = totalOrdersCount ? Math.round((completedOrdersCount / totalOrdersCount) * 100) : 0;
  const stockTotal = products.reduce((total, product) => total + Number(product.totalStock || 0), 0);
  const activeProducts = products.filter((product) => product.status === 'active').length;
  const recentOrders = orders.slice(0, 5);
  const topProducts = products.slice(0, 4);

  return (
    <section className="admin-page admin-dashboard" aria-labelledby="admin-dashboard-title">
      <div className="section-heading">
        <div>
          <h1 id="admin-dashboard-title">Tổng quan quản trị</h1>
          <p>Theo dõi đơn hàng, sản phẩm và hiệu suất vận hành cửa hàng Solely.</p>
        </div>
      </div>
      {status === 'loading' ? <p className="muted">Đang tải tổng quan...</p> : null}
      {status === 'error' ? <p className="form-error">{error}</p> : null}
      <div className="admin-metrics">
        <article className="admin-stat-card admin-stat-card--blue">
          <div>
            <DollarSign size={20} aria-hidden="true" />
            <TrendingUp size={17} aria-hidden="true" />
          </div>
          <span>Doanh thu hoàn thành</span>
          <strong>{formatMoney(hasOrderData ? paidRevenue : dashboard.completedRevenue)}</strong>
          <p>{completedOrdersCount} đơn đã hoàn thành</p>
        </article>
        <article className="admin-stat-card admin-stat-card--green">
          <div>
            <Package size={20} aria-hidden="true" />
            <TrendingUp size={17} aria-hidden="true" />
          </div>
          <span>Sản phẩm</span>
          <strong>{dashboard.productsCount}</strong>
          <p>{activeProducts || dashboard.productsCount} sản phẩm đang bán</p>
        </article>
        <article className="admin-stat-card admin-stat-card--orange">
          <div>
            <ShoppingCart size={20} aria-hidden="true" />
            <Bell size={17} aria-hidden="true" />
          </div>
          <span>Đơn chờ xử lý</span>
          <strong>{pendingOrdersCount}</strong>
          <p>{pendingRate}% tổng đơn hàng</p>
        </article>
        <article className="admin-stat-card admin-stat-card--purple">
          <div>
            <Activity size={20} aria-hidden="true" />
            <TrendingUp size={17} aria-hidden="true" />
          </div>
          <span>Tồn kho</span>
          <strong>{stockTotal || dashboard.variantsCount}</strong>
          <p>{dashboard.variantsCount} phiên bản sản phẩm</p>
        </article>
      </div>

      <div className="admin-content-grid">
        <section className="admin-subsection admin-activity-panel" aria-labelledby="recent-activity-title">
          <div className="admin-panel-heading">
            <h2 id="recent-activity-title">Hoạt động gần đây</h2>
          </div>
          <div className="admin-activity-list">
            {recentOrders.map((order) => (
              <article className="admin-activity-row" key={order.id}>
                <span className="admin-activity-icon">
                  <ShoppingCart size={16} aria-hidden="true" />
                </span>
                <div>
                  <strong>{formatOrderCode(order)}</strong>
                  <p>
                    {order.customerName} - {orderStatusLabel(order.orderStatus)}
                  </p>
                </div>
                <span>{formatMoney(order.grandTotal)}</span>
              </article>
            ))}
            {status === 'ready' && recentOrders.length === 0 ? <p className="muted">Chưa có hoạt động đơn hàng.</p> : null}
          </div>
        </section>

        <aside className="admin-side-panels">
          <section className="admin-subsection" aria-labelledby="quick-stats-title">
            <h2 id="quick-stats-title">Tổng quan nhanh</h2>
            <div className="admin-progress-list">
              <ProgressStat label="Đơn chờ xử lý" value={`${pendingRate}%`} width={pendingRate} tone="blue" />
              <ProgressStat label="Đơn hoàn thành" value={`${completedRate}%`} width={completedRate} tone="green" />
              <ProgressStat label="Sản phẩm đang bán" value={String(activeProducts || dashboard.productsCount)} width={100} tone="orange" />
            </div>
          </section>

          <section className="admin-subsection" aria-labelledby="top-products-title">
            <h2 id="top-products-title">Sản phẩm nổi bật</h2>
            <div className="admin-top-products">
              {topProducts.map((product) => (
                <div key={product.id}>
                  <span>{product.name}</span>
                  <strong>{formatMoney(product.price)}</strong>
                </div>
              ))}
              {status === 'ready' && topProducts.length === 0 ? <p className="muted">Chưa có sản phẩm.</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function ProgressStat({ label, value, width, tone }) {
  return (
    <div>
      <div className="admin-progress-meta">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="admin-progress-track" aria-hidden="true">
        <span className={`admin-progress-fill admin-progress-fill--${tone}`} style={{ width: `${Math.min(width, 100)}%` }} />
      </span>
    </div>
  );
}
