'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Order, SalesAnalytics } from '@/types';
import { format, subMonths, startOfMonth } from 'date-fns';
import { TrendingUp, ShoppingBag, Package, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface TopProduct { name: string; revenue: number; count: number; }

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<SalesAnalytics[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      setLoading(true);
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString().slice(0, 10);

      const [analyticsRes, ordersRes] = await Promise.all([
        supabase
          .from('sales_analytics')
          .select('*')
          .eq('seller_id', user.id)
          .gte('month', sixMonthsAgo)
          .order('month', { ascending: true }),
        supabase
          .from('orders')
          .select('*, order_items(*, product:products(name))')
          .eq('seller_id', user.id)
          .neq('order_status', 'cancelled')
          .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false }),
      ]);

      const ords = (ordersRes.data as Order[]) ?? [];
      setOrders(ords);
      setAnalytics((analyticsRes.data as SalesAnalytics[]) ?? []);

      // Compute top products from order items
      const productMap: Record<string, TopProduct> = {};
      ords.forEach(order => {
        order.order_items?.forEach(item => {
          const name = (item.product as { name?: string })?.name ?? 'Unknown';
          if (!productMap[name]) productMap[name] = { name, revenue: 0, count: 0 };
          productMap[name].revenue += item.unit_price * item.quantity;
          productMap[name].count += item.quantity;
        });
      });
      setTopProducts(
        Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
      );
      setLoading(false);
    };
    fetch();
  }, [user]);

  // Build chart data: last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const monthStr = format(date, 'yyyy-MM');
    const analyticsRow = analytics.find(a => a.month.startsWith(monthStr));
    const orderRevenue = orders
      .filter(o => o.created_at.startsWith(monthStr))
      .reduce((s, o) => s + Number(o.total_amount), 0);
    return {
      month: format(date, 'MMM'),
      revenue: analyticsRow?.revenue ?? orderRevenue,
      orders: analyticsRow?.total_sales ?? orders.filter(o => o.created_at.startsWith(monthStr)).length,
    };
  });

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalOrderCount = orders.length;
  const avgOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Sales Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: `₦${totalRevenue.toLocaleString()}`, icon: <TrendingUp className="w-5 h-5" /> },
          { label: 'Total Orders', value: totalOrderCount, icon: <ShoppingBag className="w-5 h-5" /> },
          { label: 'Avg. Order Value', value: `₦${avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: <Package className="w-5 h-5" /> },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-border/40 p-5">
            <div className="w-10 h-10 rounded-xl bg-accent/60 flex items-center justify-center text-primary mb-4">{card.icon}</div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-border/40 p-6">
        <h2 className="font-bold text-lg mb-5">Revenue Over Time</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: any) => [`₦${Number(v || 0).toLocaleString()}`, 'Revenue']} />
            <Bar dataKey="revenue" fill="hsl(152 63% 25%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Order volume chart */}
      <div className="bg-white rounded-2xl border border-border/40 p-6">
        <h2 className="font-bold text-lg mb-5">Order Volume</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip formatter={(v: any) => [v, 'Orders']} />
            <Line type="monotone" dataKey="orders" stroke="hsl(152 63% 25%)" strokeWidth={2} dot={{ fill: 'hsl(152 63% 25%)', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top products */}
      <div className="bg-white rounded-2xl border border-border/40 p-6">
        <h2 className="font-bold text-lg mb-5">Top Products</h2>
        {topProducts.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No sales data yet</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((product, i) => (
              <div key={product.name} className="flex items-center gap-4">
                <span className="w-6 text-sm font-bold text-muted-foreground">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{product.name}</span>
                    <span className="font-bold text-sm text-primary">₦{product.revenue.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(product.revenue / topProducts[0].revenue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
