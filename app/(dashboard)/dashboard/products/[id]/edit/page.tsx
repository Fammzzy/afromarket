'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Product, PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Leaf, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  stock_quantity: z.coerce.number().int().min(0),
  location: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(['active', 'inactive', 'draft']),
});

type FormData = z.infer<typeof schema>;

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  const category = watch('category');
  const unit = watch('unit');
  const status = watch('status');

  useEffect(() => {
    const id = params.id as string;
    if (!id || !user) return;

    supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('seller_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { router.push('/dashboard'); return; }
        setProduct(data as Product);
        reset({
          name: data.name,
          description: data.description ?? '',
          category: data.category,
          price: data.price,
          unit: data.unit,
          stock_quantity: data.stock_quantity,
          location: data.location ?? '',
          tags: data.tags?.join(', ') ?? '',
          status: data.status,
        });
        setLoading(false);
      });
  }, [params.id, user, router, reset]);

  const onSubmit = async (data: FormData) => {
    if (!product) return;
    setSubmitting(true);
    const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const { error } = await supabase
      .from('products')
      .update({
        name: data.name,
        description: data.description ?? '',
        category: data.category,
        price: data.price,
        unit: data.unit,
        stock_quantity: data.stock_quantity,
        location: data.location ?? '',
        tags,
        status: data.status,
      })
      .eq('id', product.id);

    if (error) { toast.error('Failed to update product'); setSubmitting(false); return; }
    toast.success('Product updated successfully');
    router.push('/dashboard');
  };

  const inputClass = 'h-11 bg-muted/40 border-border/60 rounded-xl focus:bg-white';

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold mb-6">Edit Product</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-border/40 p-6 space-y-5">
        {/* Image preview */}
        {product.image_url && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
            <Image src={product.image_url} alt={product.name} fill className="object-cover" />
          </div>
        )}
        {!product.image_url && (
          <div className="w-full aspect-video rounded-xl bg-muted flex items-center justify-center">
            <Leaf className="w-12 h-12 text-primary/20" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Product Name</Label>
          <Input {...register('name')} className={inputClass} />
          {formState.errors.name && <p className="text-xs text-destructive">{formState.errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Category</Label>
          <Select value={category} onValueChange={v => setValue('category', v)}>
            <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Description</Label>
          <Textarea {...register('description')} className="bg-muted/40 border-border/60 rounded-xl focus:bg-white resize-none" rows={4} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Unit</Label>
            <Select value={unit} onValueChange={v => setValue('unit', v)}>
              <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Price (₦)</Label>
            <Input {...register('price')} type="number" className={inputClass} />
            {formState.errors.price && <p className="text-xs text-destructive">{formState.errors.price.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Stock Quantity</Label>
            <Input {...register('stock_quantity')} type="number" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Location</Label>
            <Input {...register('location')} placeholder="City, State" className={inputClass} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tags (comma-separated)</Label>
          <Input {...register('tags')} placeholder="organic, fresh, seasonal" className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Status</Label>
          <Select value={status} onValueChange={v => setValue('status', v as 'active' | 'inactive' | 'draft')}>
            <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" type="button" className="w-full rounded-xl h-11">Cancel</Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex-1 rounded-xl h-11 bg-primary gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
