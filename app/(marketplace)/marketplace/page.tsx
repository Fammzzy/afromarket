'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Product, PRODUCT_CATEGORIES } from '@/types';
import { ProductCard } from '@/components/marketplace/product-card';
import { Search, Loader2, Package, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const HERO_CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Fruits & Veg', value: 'Fruits & Vegetables' },
  { label: 'Grains', value: 'Grains & Cereals' },
  { label: 'Dairy & Eggs', value: 'Dairy & Eggs' },
  { label: 'Meat', value: 'Meat & Poultry' },
  { label: 'Fish', value: 'Fish & Seafood' },
  { label: 'Herbs', value: 'Herbs & Spices' },
  { label: 'Honey', value: 'Honey & Sweeteners' },
];

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 12;

  // Sync searchQuery with URL q parameter
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearchQuery(q);
    setPage(0);
  }, [searchParams]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('status', 'active')
        .gt('stock_quantity', 0);

      if (activeCategory) {
        query = query.eq('category', activeCategory);
      }

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%,category.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (!error) {
        const prods = (data as Product[]) ?? [];
        const sellerIds = Array.from(new Set(prods.map(p => p.seller_id).filter(Boolean)));
        
        if (sellerIds.length > 0) {
          const { data: sellers } = await supabase
            .from('users')
            .select('id, full_name, location, avatar_url')
            .in('id', sellerIds);
          
          const sellerMap = new Map(sellers?.map(s => [s.id, s]) ?? []);
          prods.forEach(p => {
            p.seller = (sellerMap.get(p.seller_id) as any) || undefined;
          });
        }
        
        setProducts(prods);
        setTotalCount(count ?? 0);
      } else {
        toast.error('Failed to load products');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    if (searchQuery.trim()) {
      router.push(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/marketplace');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(0);
    router.push('/marketplace');
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Search */}
      <div className="text-center py-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
          Farm Fresh,{' '}
          <span className="text-primary">Direct to You</span>
        </h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
          Discover thousands of farm-fresh products from verified sellers across the country.
        </p>
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search farm fresh produce..."
                className="pl-11 h-12 bg-white border-border rounded-xl shadow-sm text-base"
              />
            </div>
            <Button type="submit" className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 font-semibold">
              Search
            </Button>
          </div>
        </form>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {HERO_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => {
              setActiveCategory(cat.value);
              setPage(0);
              router.push('/marketplace');
            }}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all border',
              activeCategory === cat.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-white text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Unified Product Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {activeCategory ? activeCategory : searchQuery ? 'Search Results' : 'Latest Produce'}
            <span className="text-sm font-normal text-muted-foreground ml-2">({totalCount} items)</span>
          </h2>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={handleClearSearch} className="text-primary hover:text-primary/80">
              Clear Search
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground bg-white border border-border/40 rounded-2xl p-8">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-base mb-1">No products found</p>
            <p className="text-sm">Try choosing a different category or search term.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} items
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-9 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-9 text-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7f5]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
