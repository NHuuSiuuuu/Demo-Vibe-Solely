import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const EMPTY_CART = { items: [], subtotal: 0 };
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { token, user, isAdmin } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);

  async function refreshCart() {
    if (!token || !user || isAdmin) {
      setCart(EMPTY_CART);
      return EMPTY_CART;
    }

    const data = await apiClient.get('/api/cart', { token });
    setCart(data.cart);
    return data.cart;
  }

  async function addItem(variantId, quantity = 1) {
    const data = await apiClient.post('/api/cart/items', { variantId, quantity }, { token });
    setCart(data.cart);
    return data.cart;
  }

  async function updateItem(itemId, quantity) {
    const data = await apiClient.patch(`/api/cart/items/${itemId}`, { quantity }, { token });
    setCart(data.cart);
    return data.cart;
  }

  async function removeItem(itemId) {
    const data = await apiClient.delete(`/api/cart/items/${itemId}`, { token });
    setCart(data.cart);
    return data.cart;
  }

  useEffect(() => {
    refreshCart().catch(() => setCart(EMPTY_CART));
  }, [token, user?.id, isAdmin]);

  const value = useMemo(
    () => ({ cart, refreshCart, addItem, updateItem, removeItem }),
    [cart, token, user, isAdmin]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
