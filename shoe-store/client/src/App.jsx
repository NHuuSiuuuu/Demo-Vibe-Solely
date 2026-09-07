import { useMemo } from 'react';
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import Layout from './components/Layout.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage.jsx';
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx';
import AdminProductFormPage from './pages/admin/AdminProductFormPage.jsx';
import AdminProductsPage from './pages/admin/AdminProductsPage.jsx';
import AdminRagPage from './pages/admin/AdminRagPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';
import ProductListPage from './pages/ProductListPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

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
              path: '*',
              element: <Navigate to="/" replace />
            }
          ]
        },
        {
          path: 'admin',
          element: <AdminLayout />,
          children: [
            {
              index: true,
              element: <AdminDashboardPage />
            },
            {
              path: 'products',
              element: <AdminProductsPage />
            },
            {
              path: 'categories',
              element: <AdminCategoriesPage />
            },
            {
              path: 'products/new',
              element: <AdminProductFormPage />
            },
            {
              path: 'products/:id/edit',
              element: <AdminProductFormPage />
            },
            {
              path: 'orders',
              element: <AdminOrdersPage />
            },
            {
              path: 'orders/:id',
              element: <AdminOrderDetailPage />
            },
            {
              path: 'rag',
              element: <AdminRagPage />
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
