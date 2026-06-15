'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  MapPin, Phone, FileText, CreditCard, ChevronRight, Loader2, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const schema = z.object({
  delivery_address: z.string().min(10, 'Please enter a full delivery address'),
  delivery_phone: z.string().min(8, 'Please enter a valid phone number'),
  delivery_notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user, profile } = useAuth();
  const [placing, setPlacing] = useState(false);

  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { delivery_phone: profile?.phone_number ?? '' },
  });

  const subtotal = items.reduce((sum, item) => {
    return sum + ((item.product as { price?: number })?.price ?? 0) * item.quantity;
  }, 0);

  const onSubmit = async (data: FormData) => {
    if (!user || items.length === 0) return;
    setPlacing(true);

    try {
      // Group items by seller
      const sellerGroups: Record<string, typeof items> = {};
      for (const item of items) {
        const sellerId = (item.product as { seller_id?: string })?.seller_id;
        if (!sellerId) continue;
        if (!sellerGroups[sellerId]) sellerGroups[sellerId] = [];
        sellerGroups[sellerId].push(item);
      }

      const orderIds: string[] = [];
      for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
        const orderTotal = sellerItems.reduce((s, i) => s + ((i.product as { price?: number })?.price ?? 0) * i.quantity, 0);

        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            buyer_id: user.id,
            seller_id: sellerId,
            total_amount: orderTotal,
            delivery_address: data.delivery_address,
            delivery_phone: data.delivery_phone,
            delivery_notes: data.delivery_notes ?? '',
          })
          .select('id')
          .single();

        if (error) throw error;
        orderIds.push(order.id);

        // Insert order items
        await supabase.from('order_items').insert(
          sellerItems.map(i => ({
            order_id: order.id,
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: (i.product as { price?: number })?.price ?? 0,
          }))
        );

        // Notify seller of new order
        const { error: sellerNotifError } = await supabase.from('notifications').insert({
          user_id: sellerId,
          type: 'new_order',
          title: 'New Order Received',
          message: `You have a new order of ${sellerItems.length} item(s) totaling ₦${orderTotal.toLocaleString()}.`,
          is_read: false,
          metadata: { order_id: order.id },
        });

        if (sellerNotifError) {
          console.error('Failed to notify seller:', sellerNotifError);
        }

        // Notify buyer with order confirmation
        const { error: buyerNotifError } = await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'order_placed',
          title: 'Order Placed Successfully',
          message: `Your order #${order.id.slice(0, 8).toUpperCase()} has been placed and is awaiting confirmation from the seller.`,
          is_read: false,
          metadata: { order_id: order.id },
        });

        if (buyerNotifError) {
          console.error('Failed to notify buyer:', buyerNotifError);
        }
      }

      await clearCart();
      toast.success('Order placed successfully!');
      router.push(`/orders/${orderIds[0]}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold mb-4">Sign in to checkout</h2>
        <Link href="/login"><Button className="rounded-xl bg-primary">Sign In</Button></Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <Link href="/marketplace"><Button className="rounded-xl bg-primary mt-4">Shop Now</Button></Link>
      </div>
    );
  }

  const inputClass = "h-11 bg-muted/50 border-border/60 rounded-xl focus:bg-white";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Checkout</h1>
      <p className="text-muted-foreground mb-8">Review your order and enter delivery details</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Delivery form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> Delivery Details
              </h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Delivery Address</Label>
                  <Input
                    {...register('delivery_address')}
                    placeholder="Enter your full delivery address"
                    className={inputClass}
                  />
                  {formState.errors.delivery_address && (
                    <p className="text-xs text-destructive">{formState.errors.delivery_address.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone Number
                  </Label>
                  <Input
                    {...register('delivery_phone')}
                    type="tel"
                    placeholder="+234 000 000 0000"
                    className={inputClass}
                  />
                  {formState.errors.delivery_phone && (
                    <p className="text-xs text-destructive">{formState.errors.delivery_phone.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Delivery Notes <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    {...register('delivery_notes')}
                    placeholder="Any special instructions for delivery..."
                    className="bg-muted/50 border-border/60 rounded-xl focus:bg-white resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" /> Payment Method
              </h2>
              <div className="flex items-center gap-3 p-4 bg-accent/40 rounded-xl border border-primary/20">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Pay on Delivery</p>
                  <p className="text-xs text-muted-foreground">Cash payment when your order arrives</p>
                </div>
                <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={placing}
              className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-base gap-2 h-12"
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Package className="w-4 h-4" />Place Order</>}
            </Button>
          </form>
        </div>

        {/* Order summary */}
        <div>
          <div className="bg-white rounded-2xl border border-border/40 p-5 sticky top-24">
            <h2 className="font-bold text-lg mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {items.map(item => {
                const p = item.product as { name?: string; image_url?: string; price?: number; unit?: string } | undefined;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground line-clamp-1 flex-1">
                      {p?.name ?? 'Product'} × {item.quantity}
                    </span>
                    <span className="font-medium shrink-0">
                      ₦{((p?.price ?? 0) * item.quantity).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            <Separator className="mb-4" />
            <div className="flex items-center justify-between font-bold">
              <span>Total</span>
              <span className="text-primary text-lg">₦{subtotal.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Payment is collected upon delivery. No online payment required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
