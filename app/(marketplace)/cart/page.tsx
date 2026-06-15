'use client';

import { useState } from 'react';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight, Leaf, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export default function CartPage() {
  const { items, loading, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const handleUpdateQuantity = async (itemId: string, newQty: number, maxStock: number) => {
    if (newQty > maxStock) {
      toast.error(`Only ${maxStock} items available in stock`);
      return;
    }
    setUpdatingItemId(itemId);
    try {
      await updateQuantity(itemId, newQty);
    } catch (err) {
      toast.error('Failed to update quantity');
      console.error(err);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveFromCart = async (itemId: string) => {
    setUpdatingItemId(itemId);
    try {
      await removeFromCart(itemId);
      toast.success('Item removed from cart');
    } catch (err) {
      toast.error('Failed to remove item');
      console.error(err);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const subtotal = items.reduce((sum, item) => {
    const price = (item.product as { price?: number })?.price ?? 0;
    return sum + price * item.quantity;
  }, 0);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingCart className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to view your cart</h2>
        <p className="text-muted-foreground mb-6">Your cart items will appear here after signing in.</p>
        <Link href="/login"><Button className="rounded-xl h-11 bg-primary">Sign In</Button></Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
          <ShoppingCart className="w-9 h-9 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Browse fresh produce and add items to your cart.</p>
        <Link href="/marketplace"><Button className="rounded-xl h-11 bg-primary">Shop Now</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map(item => {
            const product = item.product as { name?: string; image_url?: string; price?: number; unit?: string; stock_quantity?: number; seller?: { full_name?: string } } | undefined;
            const price = product?.price ?? 0;
            const stockQuantity = product?.stock_quantity ?? 999;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-border/40 p-4 flex items-center gap-4">
                {/* Image */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                  {product?.image_url ? (
                    <Image src={product.image_url} alt={product.name ?? ''} fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Leaf className="w-6 h-6 text-primary/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.product_id}`} className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                    {product?.name ?? 'Product'}
                  </Link>
                  {product?.seller && (
                    <p className="text-xs text-muted-foreground mt-0.5">{product.seller.full_name}</p>
                  )}
                  <p className="text-sm font-semibold text-primary mt-1">₦{(price * item.quantity).toLocaleString()}</p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center border border-border rounded-xl overflow-hidden shrink-0">
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1, stockQuantity)}
                    disabled={updatingItemId !== null}
                    className="px-3 py-2 hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 py-2 text-sm font-semibold border-x border-border min-w-[40px] text-center flex items-center justify-center">
                    {updatingItemId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      item.quantity
                    )}
                  </span>
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1, stockQuantity)}
                    disabled={updatingItemId !== null}
                    className="px-3 py-2 hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemoveFromCart(item.id)}
                  disabled={updatingItemId !== null}
                  className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-border/40 p-5 sticky top-24">
            <h2 className="font-bold text-lg mb-5">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Items ({items.reduce((s, i) => s + i.quantity, 0)})</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span className="text-muted-foreground">Calculated at checkout</span>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between font-bold text-base mb-5">
              <span>Subtotal</span>
              <span className="text-primary text-lg">₦{subtotal.toLocaleString()}</span>
            </div>

            <div className="p-3 bg-accent/50 rounded-xl text-xs text-muted-foreground mb-4">
              <p className="font-medium text-foreground mb-0.5">Pay on Delivery</p>
              You pay when your order arrives. No upfront payment required.
            </div>

            <Button
              onClick={() => router.push('/checkout')}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold gap-2"
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </Button>

            <Link href="/marketplace" className="block text-center text-sm text-primary hover:underline mt-3">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
