import { useMemo } from 'react';
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import Layout from './components/Layout.jsx';
import StatusBadge from './components/StatusBadge.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';
import ProductListPage from './pages/ProductListPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

function PlaceholderPage({ title, badge, children }) {
  return (
    <section className="content-panel" aria-labelledby={`${title.toLowerCase()}-title`}>
      <div className="section-heading">
        <h1 id={`${title.toLowerCase()}-title`}>{title}</h1>
        {badge ? <StatusBadge tone="info">{badge}</StatusBadge> : null}
      </div>
      <p>{children}</p>
    </section>
  );
}

function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <AppProviders />,
      children: [
        {
          element: <Layout />,
          children: [
            {
              index: true,
              element: <HomePage />
            },
            {
              path: 'products',
              element: <ProductListPage />
            },
            {
              path: 'products/:slug',
              element: <ProductDetailPage />
            },
            {
              path: 'cart',
              element: <CartPage />
            },
            {
              path: 'checkout',
              element: <CheckoutPage />
            },
            {
              path: 'orders',
              element: <OrdersPage />
            },
            {
              path: 'orders/:id',
              element: <OrderDetailPage />
            },
            {
              path: 'login',
              element: <LoginPage />
            },
            {
              path: 'register',
              element: <RegisterPage />
            },
            {
              path: 'admin',
              element: (
                <PlaceholderPage title="Admin" badge="Task 10">
                  Admin dashboard pages will be implemented in the admin task.
                </PlaceholderPage>
              )
            },
            {
              path: '*',
              element: <Navigate to="/" replace />
            }
          ]
        }
      ]
    }
  ]);
}

function AppProviders() {
  return (
    <AuthProvider>
      <CartProvider>
        <Outlet />
      </CartProvider>
    </AuthProvider>
  );
}

export default function App() {
  const router = useMemo(() => createAppRouter(), []);
  return <RouterProvider router={router} />;
}
