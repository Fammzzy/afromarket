'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import {
  ShoppingCart, MapPin, Package, ArrowLeft,
  User, Star, Leaf, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProductCard } from '@/components/marketplace/product-card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [activeImg, setActiveImg] = useState(0);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) { router.push('/marketplace'); return; }

      const prod = data as Product;
      if (prod.seller_id) {
        const { data: sellerData } = await supabase
          .from('users')
          .select('id, full_name, location, avatar_url, email')
          .eq('id', prod.seller_id)
          .maybeSingle();
        prod.seller = (sellerData as any) || undefined;
      }
      setProduct(prod);

      const imgList = [data.image_url].filter(Boolean) as string[];
      const { data: extraImgs } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', id)
        .order('display_order');
      extraImgs?.forEach(i => { if (!imgList.includes(i.image_url)) imgList.push(i.image_url); });
      setImages(imgList);

      const { data: sim } = await supabase
        .from('products')
        .select('*')
        .eq('category', data.category)
        .eq('status', 'active')
        .neq('id', id)
        .limit(4);
      
      const simProds = (sim as Product[]) ?? [];
      const simSellerIds = Array.from(new Set(simProds.map(p => p.seller_id).filter(Boolean)));
      if (simSellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('users')
          .select('id, full_name, location')
          .in('id', simSellerIds);
        
        const sellerMap = new Map(sellers?.map(s => [s.id, s]) ?? []);
        simProds.forEach(p => {
          p.seller = (sellerMap.get(p.seller_id) as any) || undefined;
        });
      }
      setSimilar(simProds);
      setLoading(false);
    };
    fetch();
  }, [params.id, router]);

  const handleAddToCart = async () => {
    if (!user) { toast.error('Please sign in to add items to cart'); return; }
    if (!product) return;
    setAddingToCart(true);
    await addToCart(product.id, qty);
    toast.success(`${qty}x ${product.name} added to cart`);
    setAddingToCart(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) return null;

  const seller = product.seller as { full_name?: string; location?: string; avatar_url?: string; email?: string } | null;
  const isOutOfStock = product.stock_quantity === 0;
  const sellerInitials = seller?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'S';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <Link href="/marketplace" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Browse
        </Link>
        <span>/</span>
        <span>{product.category}</span>
        <span>/</span>
        <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
            {images.length > 0 ? (
              <Image src={images[activeImg]} alt={product.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Leaf className="w-16 h-16 text-primary/20" />
              </div>
            )}
            {images.length > 1 && (
              <>
                <button onClick={() => setActiveImg(i => Math.max(0, i - 1))} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setActiveImg(i => Math.min(images.length - 1, i + 1))} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={cn('relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all', activeImg === i ? 'border-primary' : 'border-transparent')}
                >
                  <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{product.category}</span>
              <h1 className="text-3xl font-bold mt-1">{product.name}</h1>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-primary">₦{product.price.toLocaleString()}</span>
            <span className="text-muted-foreground">/ {product.unit}</span>
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2 mb-6">
            {isOutOfStock ? (
              <Badge variant="destructive" className="rounded-full">Out of Stock</Badge>
            ) : product.stock_quantity <= 10 ? (
              <Badge className="rounded-full bg-orange-100 text-orange-700 border-0">Low Stock — {product.stock_quantity} left</Badge>
            ) : (
              <Badge className="rounded-full bg-green-100 text-green-700 border-0">
                <Package className="w-3 h-3 mr-1" /> {product.stock_quantity} {product.unit} available
              </Badge>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mb-6">
              <h3 className="font-semibold text-sm mb-2">Description</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {product.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="rounded-full text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Quantity + Cart */}
          {!isOutOfStock && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center border border-border rounded-xl overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-2.5 hover:bg-muted text-sm font-medium transition-colors">−</button>
                <span className="px-4 py-2.5 text-sm font-semibold border-x border-border min-w-[48px] text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock_quantity, q + 1))} className="px-4 py-2.5 hover:bg-muted text-sm font-medium transition-colors">+</button>
              </div>
              <Button onClick={handleAddToCart} disabled={addingToCart} className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold gap-2">
                {addingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                Add to Cart
              </Button>
            </div>
          )}

          {/* Seller */}
          {seller && (
            <div className="mt-6 p-4 bg-muted/40 rounded-2xl border border-border/40">
              <h3 className="font-semibold text-sm mb-3">About the Seller</h3>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={seller.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{sellerInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{seller.full_name}</p>
                  {seller.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{seller.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Similar Products */}
      {similar.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-5">Similar Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {similar.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
