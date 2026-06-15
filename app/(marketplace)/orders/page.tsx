'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';
import { Package, Loader2, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'buying' | 'selling'>('buying');

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const col = tab === 'buying' ? 'buyer_id' : 'seller_id';
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(name, image_url))')
        .eq(col, user.id)
        .order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [user, tab]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold mb-4">Sign in to view orders</h2>
        <Link href="/login"><Button className="rounded-xl bg-primary">Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Orders</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit mb-6">
        {(['buying', 'selling'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'buying' ? 'My Purchases' : 'My Sales'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">No orders yet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {tab === 'buying' ? 'Browse the marketplace and place your first order.' : 'List products to start selling.'}
          </p>
          <Link href={tab === 'buying' ? '/marketplace' : '/dashboard/products/new'}>
            <Button className="rounded-xl bg-primary">{tab === 'buying' ? 'Browse Products' : 'List a Product'}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <div className="bg-white rounded-2xl border border-border/40 p-5 hover:border-primary/20 hover:shadow-sm transition-all flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/50 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                    <Badge className={cn('text-xs border-0 rounded-full', ORDER_STATUS_COLORS[order.order_status])}>
                      {ORDER_STATUS_LABELS[order.order_status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(order.created_at), 'MMM d, yyyy')}
                    </span>
                    <span>•</span>
                    <span>{order.order_items?.length ?? 0} item(s)</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary">₦{order.total_amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {order.payment_status.replace('_', ' ')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
