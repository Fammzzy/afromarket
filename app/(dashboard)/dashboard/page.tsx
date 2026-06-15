'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Product, Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';
import {
  Package, ShoppingBag, TrendingUp, ArrowRight, Plus, Pencil,
  Trash2, ToggleLeft, ToggleRight, Loader2, Filter, Download, Leaf
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Stats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

interface ChartEntry { month: string; revenue: number; orders: number; }

function StatCard({ label, value, icon, badge, trend }: {
  label: string; value: string | number; icon: React.ReactNode;
  badge?: string; trend?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border/40 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent/60 flex items-center justify-center text-primary">{icon}</div>
        {badge && <span className="text-xs text-muted-foreground font-medium">{badge}</span>}
      </div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {trend && <p className="text-xs text-green-600 font-medium mt-1">{trend}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalOrders: 0, totalRevenue: 0, monthlyRevenue: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<ChartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const [prodRes, ordersRes, analyticsRes] = await Promise.all([
        supabase.from('products').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*, order_items(*)').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('sales_analytics').select('*').eq('seller_id', user.id).order('month', { ascending: true }).limit(12),
      ]);

      const prods = (prodRes.data as Product[]) ?? [];
      const ords = (ordersRes.data as Order[]) ?? [];
      const analytics = analyticsRes.data ?? [];

      const totalRevenue = ords.filter(o => o.order_status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthlyRevenue = ords
        .filter(o => o.created_at.startsWith(thisMonth) && o.order_status !== 'cancelled')
        .reduce((s, o) => s + Number(o.total_amount), 0);

      setStats({
        totalProducts: prods.length,
        totalOrders: ords.length,
        totalRevenue,
        monthlyRevenue,
      });
      setProducts(prods);
      setRecentOrders(ords);
      setChartData(
        analytics.length > 0
          ? analytics.map(a => ({ month: format(new Date(a.month), 'MMM'), revenue: a.revenue, orders: a.total_sales }))
          : [
            { month: 'Jan', revenue: 0, orders: 0 }, { month: 'Feb', revenue: 0, orders: 0 },
            { month: 'Mar', revenue: 0, orders: 0 }, { month: 'Apr', revenue: 0, orders: 0 },
            { month: 'May', revenue: 0, orders: 0 }, { month: 'Jun', revenue: 0, orders: 0 },
          ]
      );
      setLoading(false);
    };
    fetch();
  }, [user]);

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast.error('Failed to delete product'); return; }
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Product deleted');
  };

  const toggleStatus = async (product: Product) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('products').update({ status: newStatus }).eq('id', product.id);
    if (error) { toast.error('Failed to update'); return; }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    toast.success(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  };

  const paginatedProducts = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  const greet = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Seller Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Good {greet}, {profile?.full_name?.split(' ')[0] ?? 'Farmer'}. Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/analytics">
            <Button variant="outline" className="rounded-xl h-10 gap-2">
              View Analytics <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/dashboard/products/new">
            <Button className="rounded-xl h-10 bg-primary gap-2">
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Products" value={stats.totalProducts} icon={<Package className="w-5 h-5" />} badge="+2 this week" />
        <StatCard label="Total Orders" value={stats.totalOrders} icon={<ShoppingBag className="w-5 h-5" />} badge={`${recentOrders.filter(o => o.order_status === 'pending').length} pending`} />
        <StatCard label="Total Sales" value={`₦${stats.totalRevenue.toLocaleString()}`} icon={<TrendingUp className="w-5 h-5" />} trend="+15.4% this month" />
        {/* Revenue chart mini */}
        <div className="bg-gradient-to-br from-primary/80 to-primary rounded-2xl p-5 text-white">
          <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide mb-1">Revenue Trends</p>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="revenue" fill="rgba(255,255,255,0.5)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-2xl border border-border/40">
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h2 className="font-bold text-lg">Manage Products</h2>
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
              <Button className="rounded-xl bg-primary h-10 gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
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
                            {product.status === 'active' ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
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
                                <AlertDialogDescription>This will permanently delete &ldquo;{product.name}&rdquo;. This action cannot be undone.</AlertDialogDescription>
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
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, products.length)} of {products.length} products
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button size="sm" className="h-8 rounded-xl text-xs bg-primary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-border/40">
          <div className="flex items-center justify-between p-5 border-b border-border/40">
            <h2 className="font-bold text-lg">Recent Orders</h2>
            <Link href="/orders" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {recentOrders.map(order => (
              <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">#{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                </div>
                <Badge className={cn('text-xs border-0 rounded-full', ORDER_STATUS_COLORS[order.order_status])}>
                  {ORDER_STATUS_LABELS[order.order_status]}
                </Badge>
                <p className="font-bold text-sm text-primary">₦{order.total_amount.toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
