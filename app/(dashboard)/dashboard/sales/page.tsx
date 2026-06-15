'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Order, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';
import { ShoppingBag, Loader2, Filter, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

type FilterStatus = 'all' | OrderStatus;

export default function SalesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!user) return;
    const fetchSales = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(name, image_url))')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load sales orders');
      } else {
        const salesOrders = (data as Order[]) ?? [];
        
        // Fetch buyer names programmatically (Client-side join workaround)
        const buyerIds = Array.from(new Set(salesOrders.map(o => o.buyer_id).filter(Boolean)));
        if (buyerIds.length > 0) {
          const { data: buyers } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', buyerIds);
          
          const buyerMap = new Map(buyers?.map(b => [b.id, b]) ?? []);
          salesOrders.forEach(o => {
            o.buyer = (buyerMap.get(o.buyer_id) as any) || undefined;
          });
        }
        
        setOrders(salesOrders);
      }
      setLoading(false);
    };
    fetchSales();
  }, [user]);

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.order_status === filter;
  });

  const paginatedOrders = filteredOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);

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
      <div>
        <h1 className="text-3xl font-bold">My Sales</h1>
        <p className="text-muted-foreground mt-1">
          Track incoming orders, manage fulfillment status, and monitor your revenue.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {(['all', 'pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === s 
                ? 'bg-white shadow-sm text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'all' ? 'All Orders' : ORDER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h2 className="font-bold text-lg">
            {filter === 'all' ? 'All' : ORDER_STATUS_LABELS[filter as OrderStatus]} Sales ({filteredOrders.length})
          </h2>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
            <p className="font-semibold mb-1">No sales orders found</p>
            <p className="text-muted-foreground text-sm">
              {filter === 'all' 
                ? 'When customers purchase your listed produce, orders will show up here.' 
                : `No orders are currently marked as "${ORDER_STATUS_LABELS[filter as OrderStatus]}".`}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-5 py-3">Order ID</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3">Date</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3 hidden sm:table-cell">Customer</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3 hidden md:table-cell">Items</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3">Total Amount</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left px-3 py-3">Status</th>
                    <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map(order => {
                    const buyerName = (order.buyer as { full_name?: string } | undefined)?.full_name ?? 'Buyer';
                    const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
                    return (
                      <tr key={order.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-4 font-semibold text-sm">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                        </td>
                        <td className="px-3 py-4 text-sm hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{buyerName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-muted-foreground hidden md:table-cell">
                          {itemCount} item(s)
                        </td>
                        <td className="px-3 py-4 text-sm font-bold text-primary">
                          ₦{order.total_amount.toLocaleString()}
                        </td>
                        <td className="px-3 py-4">
                          <Badge className={`text-xs border-0 rounded-full ${ORDER_STATUS_COLORS[order.order_status]}`}>
                            {ORDER_STATUS_LABELS[order.order_status]}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end">
                            <Link href={`/orders/${order.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-3 rounded-lg hover:bg-muted hover:text-primary">
                                Manage <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} orders
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" className="h-8 rounded-xl text-xs bg-primary text-white" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
