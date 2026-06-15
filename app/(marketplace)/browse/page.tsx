'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, PRODUCT_CATEGORIES } from '@/types';
import { ProductCard } from '@/components/marketplace/product-card';
import { Search, SlidersHorizontal, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export default function BrowsePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState([0, 100000]);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .gte('price', priceRange[0])
        .lte('price', priceRange[1]);

      if (category !== 'all') query = query.eq('category', category);
      if (inStockOnly) query = query.gt('stock_quantity', 0);
      if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

      if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
      else if (sortBy === 'price_asc') query = query.order('price', { ascending: true });
      else if (sortBy === 'price_desc') query = query.order('price', { ascending: false });

      const { data, error } = await query.limit(48);
      if (!error) {
        const prods = (data as Product[]) ?? [];
        const sellerIds = Array.from(new Set(prods.map(p => p.seller_id).filter(Boolean)));
        
        if (sellerIds.length > 0) {
          const { data: sellers } = await supabase
            .from('users')
            .select('id, full_name, location')
            .in('id', sellerIds);
          
          const sellerMap = new Map(sellers?.map(s => [s.id, s]) ?? []);
          prods.forEach(p => {
            p.seller = (sellerMap.get(p.seller_id) as any) || undefined;
          });
        }
        setProducts(prods);
      } else {
        setProducts([]);
      }
      setLoading(false);
    };
    const timer = setTimeout(fetch, 300);
    return () => clearTimeout(timer);
  }, [search, category, sortBy, priceRange, inStockOnly]);

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-3">Category</h3>
        <div className="space-y-2">
          <button
            onClick={() => setCategory('all')}
            className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', category === 'all' ? 'bg-accent text-primary font-medium' : 'hover:bg-muted text-muted-foreground')}
          >
            All Categories
          </button>
          {PRODUCT_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', category === cat ? 'bg-accent text-primary font-medium' : 'hover:bg-muted text-muted-foreground')}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Price Range</h3>
        <Slider
          min={0} max={100000} step={500}
          value={priceRange}
          onValueChange={setPriceRange}
          className="mb-2"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>₦{priceRange[0].toLocaleString()}</span>
          <span>₦{priceRange[1].toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="instock" checked={inStockOnly} onCheckedChange={v => setInStockOnly(!!v)} />
        <Label htmlFor="instock" className="text-sm cursor-pointer">In stock only</Label>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-9 h-10 bg-white rounded-xl"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40 h-10 rounded-xl bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 rounded-xl lg:hidden gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 pt-14">
            <h2 className="font-bold text-lg mb-6">Filters</h2>
            <FilterPanel />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-8">
        {/* Sidebar filters - desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="bg-white rounded-2xl border border-border/40 p-4 sticky top-24">
            <h2 className="font-bold text-base mb-5">Filters</h2>
            <FilterPanel />
          </div>
        </aside>

        {/* Products grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading...' : `${products.length} products found`}
            </p>
          </div>
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-muted-foreground text-lg mb-2">No products found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
