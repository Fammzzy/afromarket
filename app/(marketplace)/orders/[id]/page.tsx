'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { sendEmailNotification } from '@/lib/email';
import { Order, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, BankAccount } from '@/types';
import {
  Package, MapPin, Phone, ArrowLeft, CheckCircle2, Circle,
  Clock, Truck, Home, XCircle, Loader2, Leaf, CreditCard
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_STEPS: OrderStatus[] = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  confirmed: <CheckCircle2 className="w-4 h-4" />,
  processing: <Package className="w-4 h-4" />,
  out_for_delivery: <Truck className="w-4 h-4" />,
  delivered: <Home className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const id = params.id as string;
    if (!id || !user) return;

    supabase
      .from('orders')
      .select('*, order_items(*, product:products(name, image_url, unit))')
      .eq('id', id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) { router.push('/orders'); return; }
        
        const orderData = data as any;
        const userIds = [orderData.seller_id, orderData.buyer_id].filter(Boolean);
        
        if (userIds.length > 0) {
          const { data: userData } = await supabase
            .from('users')
            .select('id, full_name, phone_number, avatar_url, location')
            .in('id', userIds);
            
          const userMap = new Map(userData?.map(u => [u.id, u]) ?? []);
          orderData.seller = userMap.get(orderData.seller_id) || null;
          orderData.buyer = userMap.get(orderData.buyer_id) || null;
          
          if (orderData.seller_id) {
            const { data: bankData } = await supabase
              .from('bank_accounts')
              .select('*')
              .eq('user_id', orderData.seller_id)
              .maybeSingle();
            orderData.seller_bank = bankData;
          }
        }

        setOrder(orderData as Order);
        setLoading(false);
      });
  }, [params.id, user, router]);

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    setUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ order_status: newStatus })
      .eq('id', order.id);

    if (error) { toast.error('Failed to update status'); setUpdating(false); return; }

    // Notify buyer
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: order.buyer_id,
      type: 'order_status_change',
      title: 'Order Status Updated',
      message: `Your order #${order.id.slice(0, 8).toUpperCase()} is now ${ORDER_STATUS_LABELS[newStatus]}.`,
      is_read: false,
      metadata: { order_id: order.id },
    });

    if (notifError) {
      console.error('Failed to notify buyer:', notifError);
    }

    // Send email to buyer
    if (order.buyer?.email) {
      await sendEmailNotification(
        order.buyer.email,
        'Order Status Updated',
        `<p>Your order #${order.id.slice(0, 8).toUpperCase()} status has been updated to <strong>${ORDER_STATUS_LABELS[newStatus]}</strong>.</p>`
      );
    }

    setOrder(prev => prev ? { ...prev, order_status: newStatus } : null);
    toast.success('Order status updated');
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  const isSeller = user?.id === order.seller_id;
  const currentStepIndex = STATUS_STEPS.indexOf(order.order_status);
  const isCancelled = order.order_status === 'cancelled';
  const seller = order.seller as { full_name?: string } | null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link href="/orders" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Placed {format(new Date(order.created_at), 'MMMM d, yyyy — h:mm a')}
          </p>
        </div>
        <Badge className={cn('text-sm px-3 py-1 border-0 rounded-full', ORDER_STATUS_COLORS[order.order_status])}>
          {ORDER_STATUS_LABELS[order.order_status]}
        </Badge>
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl border border-border/40 p-6 mb-5">
          <h2 className="font-bold text-base mb-5">Order Progress</h2>
          <div className="relative">
            {/* Progress line */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" style={{ marginLeft: '20px', marginRight: '20px' }}>
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${currentStepIndex >= 0 ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100 : 0}%` }}
              />
            </div>
            <div className="relative flex justify-between">
              {STATUS_STEPS.map((step, i) => {
                const isCompleted = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step} className="flex flex-col items-center gap-2 w-16">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all z-10 bg-white',
                      isCompleted ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
                    )}>
                      {STATUS_ICONS[step]}
                    </div>
                    <span className={cn('text-xs text-center leading-tight', isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                      {ORDER_STATUS_LABELS[step]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Seller update controls */}
      {isSeller && !isCancelled && order.order_status !== 'delivered' && (
        <div className="bg-white rounded-2xl border border-border/40 p-5 mb-5">
          <h2 className="font-bold text-sm mb-3">Update Order Status</h2>
          <div className="flex items-center gap-3">
            <Select value={order.order_status} onValueChange={v => updateStatus(v as OrderStatus)} disabled={updating}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_STEPS.map(s => (
                  <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
                ))}
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {updating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Order Items */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-border/40 p-5">
          <h2 className="font-bold text-base mb-4">Items Ordered</h2>
          <div className="space-y-3">
            {order.order_items?.map(item => {
              const product = item.product as { name?: string; image_url?: string; unit?: string } | null;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
                    {product?.image_url ? (
                      <Image src={product.image_url} alt={product.name ?? ''} fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Leaf className="w-5 h-5 text-primary/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{product?.name ?? 'Product'}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} {product?.unit}</p>
                  </div>
                  <p className="font-semibold text-sm">₦{(item.unit_price * item.quantity).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border mt-4 pt-4 flex items-center justify-between font-bold">
            <span>Total</span>
            <span className="text-primary text-lg">₦{order.total_amount.toLocaleString()}</span>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-2xl border border-border/40 p-5">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Delivery Info
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground font-medium">Address</p>
            <p className="leading-relaxed">{order.delivery_address}</p>
            {order.delivery_phone && (
              <>
                <p className="text-muted-foreground font-medium mt-3">Phone</p>
                <p>{order.delivery_phone}</p>
              </>
            )}
            {order.delivery_notes && (
              <>
                <p className="text-muted-foreground font-medium mt-3">Notes</p>
                <p className="text-muted-foreground">{order.delivery_notes}</p>
              </>
            )}
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-white rounded-2xl border border-border/40 p-5">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Payment
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">Pay on Delivery</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={cn('font-medium capitalize', order.payment_status === 'paid_on_delivery' ? 'text-green-600' : 'text-orange-600')}>
                {order.payment_status.replace(/_/g, ' ')}
              </span>
            </div>
            {isSeller && order.payment_status !== 'paid_on_delivery' && order.order_status === 'delivered' && (
              <Button
                size="sm"
                onClick={async () => {
                  await supabase.from('orders').update({ payment_status: 'paid_on_delivery' }).eq('id', order.id);
                  setOrder(prev => prev ? { ...prev, payment_status: 'paid_on_delivery' } : null);
                  toast.success('Payment marked as received');
                }}
                className="w-full mt-2 rounded-xl bg-green-600 hover:bg-green-700 h-9 text-xs"
              >
                Mark as Paid
              </Button>
            )}

            {/* Show Seller Bank Details for Buyer */}
            {!isSeller && order.seller_bank && order.payment_status !== 'paid_on_delivery' && (
              <div className="mt-6 pt-4 border-t border-border">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Pay via Transfer
                </h3>
                <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank Name</span>
                    <span className="font-medium text-foreground">{order.seller_bank.bank_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Number</span>
                    <span className="font-medium text-foreground">{order.seller_bank.account_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Name</span>
                    <span className="font-medium text-foreground">{order.seller_bank.account_name}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Make your transfer to the account above and wait for the seller to confirm payment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
