'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Product } from '@/types';
import {
  Package, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, Filter, Download, Leaf
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!user) return;
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load products');
      } else {
        setProducts(data ?? []);
      }
      setLoading(false);
    };
    fetchProducts();
  }, [user]);

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete product');
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Product deleted');
  };

  const toggleStatus = async (product: Product) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('products').update({ status: newStatus }).eq('id', product.id);
    if (error) {
      toast.error('Failed to update product status');
      return;
    }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    toast.success(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  };

  const paginatedProducts = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(products.length / PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your listed farm produce, update inventory, and control pricing.
          </p>
        </div>
        <Link href="/dashboard/products/new">
          <Button className="rounded-xl h-10 bg-primary gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </Link>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-2xl border border-border/40">
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h2 className="font-bold text-lg">Listed Produce ({products.length})</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl h-8 gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5" /> Filter
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-8 gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <p className="font-semibold mb-1">No products yet</p>
            <p className="text-muted-foreground text-sm mb-4">Start listing your farm produce</p>
            <Link href="/dashboard/products/new">
              <Button className="rounded-xl bg-primary h-10 gap-2">
                <Plus className="w-4 h-4" /> Add Product
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-5 py-3">Product</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3 hidden md:table-cell">Category</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3 hidden sm:table-cell">Inventory</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3">Price</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3">Status</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map(product => (
                    <tr key={product.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-muted shrink-0">
                            {product.image_url ? (
                              <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="40px" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Leaf className="w-4 h-4 text-primary/30" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-sm">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-muted-foreground hidden md:table-cell">{product.category}</td>
                      <td className="px-3 py-4 text-sm hidden sm:table-cell">
                        {product.stock_quantity} {product.unit}
                      </td>
                      <td className="px-3 py-4 text-sm font-semibold">
                        ₦{product.price.toLocaleString()} / {product.unit}
                      </td>
                      <td className="px-3 py-4">
                        {product.status === 'active' ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs rounded-full">In Stock</Badge>
                        ) : product.stock_quantity <= 10 && product.stock_quantity > 0 ? (
                          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs rounded-full">Low Stock</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs rounded-full">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/products/${product.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-muted">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-muted" onClick={() => toggleStatus(product)}>
                            {product.status === 'active' ? (
                              <ToggleRight className="w-4 h-4 text-primary" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete product?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &ldquo;{product.name}&rdquo;. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteProduct(product.id)} className="rounded-xl bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, products.length)} of {products.length} products
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button size="sm" className="h-8 rounded-xl text-xs bg-primary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
