import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatMoney } from '../../components/ProductCard.jsx';

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
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');

    Promise.all([apiClient.get('/api/admin/dashboard', { token }), apiClient.get('/api/admin/orders', { token })])
      .then(([dashboardData, ordersData]) => {
        if (!cancelled) {
          setDashboard(dashboardData.dashboard || emptyDashboard);
          setOrders(ordersData.orders || []);
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
  const paidRevenue = orders
    .filter((order) => order.paymentStatus === 'paid')
    .reduce((total, order) => total + Number(order.grandTotal || 0), 0);

  return (
    <section className="admin-page" aria-labelledby="admin-dashboard-title">
      <div className="section-heading">
        <div>
          <h1 id="admin-dashboard-title">Admin dashboard</h1>
          <p>Daily operating totals from the admin API.</p>
        </div>
      </div>
      {status === 'loading' ? <p className="muted">Loading dashboard...</p> : null}
      {status === 'error' ? <p className="form-error">{error}</p> : null}
      <div className="admin-metrics">
        <article>
          <span>Product count</span>
          <strong>{dashboard.productsCount}</strong>
        </article>
        <article>
          <span>Pending order count</span>
          <strong>{pendingOrdersCount}</strong>
        </article>
        <article>
          <span>Completed order count</span>
          <strong>{completedOrdersCount}</strong>
        </article>
        <article>
          <span>Revenue from paid orders</span>
          <strong>{formatMoney(hasOrderData ? paidRevenue : dashboard.completedRevenue)}</strong>
        </article>
      </div>
    </section>
  );
}
