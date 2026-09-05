import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import Layout from './components/Layout.jsx';
import StatusBadge from './components/StatusBadge.jsx';
import LoginPage from './pages/LoginPage.jsx';
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

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppProviders />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            index: true,
            element: (
              <PlaceholderPage title="Home" badge="MVP">
                Browse shoes, manage your cart, and review orders from the main navigation.
              </PlaceholderPage>
            )
          },
          {
            path: 'products',
            element: (
              <PlaceholderPage title="Products" badge="Task 9">
                Product browsing will be implemented in the customer shopping task.
              </PlaceholderPage>
            )
          },
          {
            path: 'cart',
            element: (
              <PlaceholderPage title="Cart" badge="Task 9">
                Cart details and checkout controls will be added with the customer shopping pages.
              </PlaceholderPage>
            )
          },
          {
            path: 'orders',
            element: (
              <PlaceholderPage title="Orders" badge="Task 9">
                Customer order history will be connected in the customer shopping task.
              </PlaceholderPage>
            )
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
  return <RouterProvider router={router} />;
}
