'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CartItem } from '@/types';
import { useAuth } from '@/contexts/auth-context';

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  cartId: string | null;
  totalItems: number;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  loading: false,
  cartId: null,
  totalItems: 0,
  addToCart: async () => {},
  removeFromCart: async () => {},
  updateQuantity: async () => {},
  clearCart: async () => {},
  refresh: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getOrCreateCart = async (userId: string): Promise<string> => {
    const { data: existing } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created } = await supabase
      .from('carts')
      .insert({ user_id: userId })
      .select('id')
      .single();
    return created!.id;
  };

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); setCartId(null); return; }
    setLoading(true);
    try {
      const cid = await getOrCreateCart(user.id);
      setCartId(cid);
      const { data: cartItems, error: cartError } = await supabase
        .from('cart_items')
        .select('*, product:products(*)')
        .eq('cart_id', cid);

      if (cartError) throw cartError;

      const itemsWithSeller = [...(cartItems ?? [])];
      const sellerIds = Array.from(
        new Set(
          itemsWithSeller
            .map(item => item.product?.seller_id)
            .filter(Boolean)
        )
      );

      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('users')
          .select('id, full_name, location')
          .in('id', sellerIds);

        const sellerMap = new Map(sellers?.map(s => [s.id, s]) ?? []);
        itemsWithSeller.forEach(item => {
          if (item.product) {
            item.product.seller = (sellerMap.get(item.product.seller_id) as any) || undefined;
          }
        });
      }

      setItems(itemsWithSeller as CartItem[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addToCart = async (productId: string, quantity = 1) => {
    if (!user || !cartId) return;
    const existing = items.find(i => i.product_id === productId);
    if (existing) {
      await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('cart_items')
        .insert({ cart_id: cartId, product_id: productId, quantity });
    }
    await fetchCart();
  };

  const removeFromCart = async (cartItemId: string) => {
    await supabase.from('cart_items').delete().eq('id', cartItemId);
    setItems(prev => prev.filter(i => i.id !== cartItemId));
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (quantity <= 0) { await removeFromCart(cartItemId); return; }
    await supabase.from('cart_items').update({ quantity }).eq('id', cartItemId);
    setItems(prev => prev.map(i => i.id === cartItemId ? { ...i, quantity } : i));
  };

  const clearCart = async () => {
    if (!cartId) return;
    await supabase.from('cart_items').delete().eq('cart_id', cartId);
    setItems([]);
  };

  return (
    <CartContext.Provider value={{
      items, loading, cartId,
      totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
      addToCart, removeFromCart, updateQuantity, clearCart,
      refresh: fetchCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
