'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Product } from '@/types';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import { ShoppingCart, MapPin, Leaf, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { items, addToCart, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);

  const cartItem = items.find(i => i.product_id === product.id);

  const handleUpdateQuantity = async (e: React.MouseEvent, cartItemId: string, newQty: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    if (newQty > product.stock_quantity) {
      toast.error(`Only ${product.stock_quantity} items available in stock`);
      return;
    }
    setUpdating(true);
    try {
      if (newQty <= 0) {
        await removeFromCart(cartItemId);
        toast.success(`${product.name} removed from cart`);
      } else {
        await updateQuantity(cartItemId, newQty);
      }
    } catch (err) {
      toast.error('Failed to update quantity');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error('Please sign in to add items to cart'); return; }
    setAdding(true);
    try {
      await addToCart(product.id, 1);
      toast.success(`${product.name} added to cart`);
    } catch (err) {
      toast.error('Failed to add item to cart');
    } finally {
      setAdding(false);
    }
  };

  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 10;
  const isOutOfStock = product.stock_quantity === 0;

  return (
    <Link href={`/products/${product.id}`} className={cn('group block', className)}>
      <div className="bg-white rounded-2xl overflow-hidden border border-border/40 hover:border-primary/20 hover:shadow-md transition-all duration-200">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-accent/40">
              <Leaf className="w-10 h-10 text-primary/30" />
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge className="absolute top-2 left-2 bg-orange-100 text-orange-700 border-0 text-xs">Low Stock</Badge>
          )}
          {isOutOfStock && (
            <Badge className="absolute top-2 left-2 bg-red-100 text-red-700 border-0 text-xs">Out of Stock</Badge>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-1">
            <span className="text-xs text-muted-foreground">{product.category}</span>
          </div>
          <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-1">{product.name}</h3>
          <p className="text-lg font-bold text-primary mb-2">
            ₦{product.price.toLocaleString()}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ {product.unit}</span>
          </p>

          <div className="flex items-center justify-between">
            <div>
              {product.seller && (
                <p className="text-xs text-muted-foreground line-clamp-1">{(product.seller as { full_name?: string }).full_name || 'Seller'}</p>
              )}
              {product.location && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground line-clamp-1">{product.location}</span>
                </div>
              )}
            </div>
            {cartItem ? (
              <div className="flex items-center gap-2" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updating}
                  onClick={(e) => handleUpdateQuantity(e, cartItem.id, cartItem.quantity - 1)}
                  className="h-8 w-8 p-0 rounded-full shrink-0 border-primary text-primary hover:bg-primary/10 hover:text-primary flex items-center justify-center font-bold text-sm"
                >
                  -
                </Button>
                <span className="text-sm font-semibold min-w-[16px] text-center flex items-center justify-center">
                  {updating ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : cartItem.quantity}
                </span>
                <Button
                  size="sm"
                  disabled={updating}
                  onClick={(e) => handleUpdateQuantity(e, cartItem.id, cartItem.quantity + 1)}
                  className="h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90 text-white shrink-0 flex items-center justify-center font-bold text-sm"
                >
                  +
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleAddToCart}
                disabled={isOutOfStock || adding}
                className="h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90 shrink-0 flex items-center justify-center"
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
