'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Upload, Sparkles, RotateCcw, CheckCircle, ArrowLeft,
  Loader2, X, Camera, Leaf, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const schema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  stock_quantity: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  location: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AIAnalysis {
  name: string;
  description: string;
  category: string;
  tags: string[];
  unit: string;
  price_range: { min: number; max: number };
  confidence: number;
}

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'error'>('idle');
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { unit: 'kg', stock_quantity: 0, category: '' },
  });

  const category = watch('category');
  const description = watch('description');
  const unit = watch('unit');

  const handleFileSelect = (file: File) => {
    if (!file.type.match(/image\/(jpeg|png|heic|webp)/)) {
      toast.error('Please upload a JPG, PNG, HEIC, or WEBP image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const analyzeWithAI = async () => {
    if (!imageFile || !user) return;
    setAnalyzing(true);
    setAnalysisStatus('uploading');
    setAnalysisErrorMessage(null);

    try {
      // Upload image to Supabase Storage
      const ext = imageFile.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile, { contentType: imageFile.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);

      setUploadedImageUrl(publicUrl);
      setAnalysisStatus('analyzing');

      // Call local API route for AI analysis
      const res = await fetch(
        '/api/gemini/analyze-product',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_url: publicUrl }),
        }
      );

      if (res.ok) {
        const analysis: AIAnalysis = await res.json();
        setAiAnalysis(analysis);
        setValue('name', analysis.name);
        setValue('description', analysis.description);
        setValue('category', analysis.category);
        setValue('unit', analysis.unit);
        setValue('price', analysis.price_range.min);
        setValue('tags', analysis.tags.join(', '));
        setAnalysisStatus('idle');
        setStep(2);
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gemini API call failed');
      }
    } catch (err: any) {
      console.error('AI analysis failed:', err);
      setAnalysisErrorMessage(err?.message || 'AI analysis is currently unavailable.');
      setAnalysisStatus('error');
      setAiAnalysis(null);
      toast.error(err?.message || 'AI analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setSubmitting(true);

    try {
      let finalImageUrl = uploadedImageUrl;

      // If we haven't uploaded yet (skipped AI), upload now
      if (!finalImageUrl && imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from('product-images')
          .upload(path, imageFile, { contentType: imageFile.type });
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
          finalImageUrl = publicUrl;
        }
      }

      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      const { error } = await supabase.from('products').insert({
        seller_id: user.id,
        name: data.name,
        description: data.description ?? '',
        category: data.category,
        price: data.price,
        unit: data.unit,
        stock_quantity: data.stock_quantity,
        location: data.location ?? '',
        tags,
        image_url: finalImageUrl,
        status: 'active',
      });

      if (error) throw error;
      toast.success('Product created successfully!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "h-11 bg-muted/40 border-border/60 rounded-xl focus:bg-white";

  if (!user) {
    return (
      <div className="text-center py-24">
        <Link href="/login"><Button className="rounded-xl bg-primary">Sign In to Continue</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
              step === s ? 'border-primary bg-primary text-white' : step > s ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground'
            )}>
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            <span className={cn('text-sm font-medium hidden sm:block', step === s ? 'text-foreground' : 'text-muted-foreground')}>
              {s === 1 ? 'Upload Image' : 'Product Details'}
            </span>
            {s < 2 && <div className={cn('h-0.5 w-8 rounded-full', step > s ? 'bg-primary' : 'bg-border')} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl border border-border/40 p-8 relative overflow-hidden">
          {/* AI Loading State Overlay */}
          {(analysisStatus === 'uploading' || analysisStatus === 'analyzing') && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-30 rounded-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
              <div className="relative mb-6">
                {/* Spinning outer ring */}
                <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                {/* Pulse inner circle */}
                <div className="absolute inset-2 bg-primary/10 rounded-full flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {analysisStatus === 'uploading' ? 'Uploading Image...' : 'Gemini AI Analyzing Product...'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                {analysisStatus === 'uploading' 
                  ? 'Saving your high-resolution product image to Supabase storage.' 
                  : 'Identifying produce, estimating price range, and generating optimal description...'}
              </p>
            </div>
          )}

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">AI Product Creation: Upload Image</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
              High-quality photos help our AI generate better descriptions, detect crop health markers, and optimize market pricing.
            </p>
          </div>

          {/* AI Error State Block */}
          {analysisStatus === 'error' && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 mb-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-bold text-destructive mb-1">AI Analysis Unsuccessful</h3>
              <p className="text-sm text-destructive-foreground/80 mb-4 max-w-md mx-auto">
                {analysisErrorMessage || 'An error occurred while communicating with Google Gemini. You can try again or fill in the product details manually.'}
              </p>
              <div className="flex justify-center gap-3">
                <Button 
                  onClick={analyzeWithAI} 
                  variant="outline" 
                  className="rounded-xl border-destructive/30 hover:bg-destructive/10 text-destructive gap-2 animate-none"
                >
                  <RotateCcw className="w-4 h-4 animate-none" /> Try Again
                </Button>
                <Button 
                  onClick={() => { setAnalysisStatus('idle'); setStep(2); }} 
                  className="rounded-xl bg-primary hover:bg-primary/95 text-white gap-2"
                >
                  Fill Manually
                </Button>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
              isDragging ? 'border-primary bg-accent/40 scale-[1.01]' : imagePreview ? 'border-primary/40' : 'border-border hover:border-primary/40 hover:bg-muted/30'
            )}
          >
            {imagePreview ? (
              <div className="relative">
                <Image src={imagePreview} alt="Preview" width={300} height={220} className="mx-auto rounded-xl object-cover max-h-56 w-auto" />
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" /> {imageFile?.name}
                  <button onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }} className="ml-2 hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-accent/60 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold mb-1">Upload Product Photo</p>
                <p className="text-sm text-muted-foreground mb-2">Drag and drop or click to browse</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, HEIC (Max 10MB)</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />

          <div className="flex gap-3 mt-6">
            <Link href="/dashboard" className="flex-1">
              <Button variant="outline" className="w-full rounded-xl h-11">Cancel</Button>
            </Link>
            <Button
              onClick={analyzeWithAI}
              disabled={!imageFile || analyzing}
              className="flex-1 rounded-xl h-11 bg-primary gap-2"
            >
              {analyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Continue</>
              )}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Or{' '}
            <button onClick={() => setStep(2)} className="text-primary hover:underline">skip and fill manually</button>
          </p>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-border/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/40">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Assistant • Step 2 of 2</span>
              </div>
              <h1 className="text-2xl font-bold">Finalize Product Details</h1>
            </div>
            {aiAnalysis && (
              <Badge className="bg-green-100 text-green-700 border-0 gap-1.5 rounded-full">
                <Sparkles className="w-3 h-3" /> AI Suggestions Active
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
            {/* Image side */}
            <div className="p-6">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted mb-3">
                {imagePreview ? (
                  <Image src={imagePreview} alt="Product" fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Leaf className="w-12 h-12 text-primary/20" />
                  </div>
                )}
                {uploadedImageUrl && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-full text-xs font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Image Analysis Complete
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setStep(1); setAiAnalysis(null); reset(); }}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Camera className="w-3.5 h-3.5" /> Change Photo
              </button>

              {aiAnalysis && (
                <div className="mt-4 p-4 bg-accent/40 rounded-xl border border-primary/10">
                  <p className="font-bold text-sm">{aiAnalysis.confidence}% AI Confidence Score</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Our computer vision model successfully identified your produce. Review the pre-filled fields for accuracy before publishing.
                  </p>
                </div>
              )}
            </div>

            {/* Form side */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Product Specifications</h2>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Product Name {aiAnalysis && <Sparkles className="w-3 h-3 text-primary" />}
                </Label>
                <Input {...register('name')} placeholder="e.g. Organic Heirloom Tomatoes" className={inputClass} />
                {formState.errors.name && <p className="text-xs text-destructive">{formState.errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Category {aiAnalysis && <Sparkles className="w-3 h-3 text-primary" />}
                </Label>
                <Select value={category} onValueChange={v => setValue('category', v)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formState.errors.category && <p className="text-xs text-destructive">{formState.errors.category.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    Description {aiAnalysis && <Sparkles className="w-3 h-3 text-primary" />}
                  </span>
                  {aiAnalysis && (
                    <button type="button" onClick={() => setValue('description', aiAnalysis.description)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <RotateCcw className="w-3 h-3" /> Regenerate
                    </button>
                  )}
                </Label>
                <Textarea {...register('description')} placeholder="Describe your product..." className="bg-muted/40 border-border/60 rounded-xl focus:bg-white resize-none text-sm" rows={4} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Quantity Units {aiAnalysis && <Sparkles className="w-3 h-3 text-primary animate-pulse" />}
                  </Label>
                  <Select value={unit} onValueChange={v => setValue('unit', v)}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_UNITS.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formState.errors.unit && <p className="text-xs text-destructive">{formState.errors.unit.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Unit Price (₦)</Label>
                  <Input {...register('price')} type="number" placeholder="0" className={inputClass} />
                  {formState.errors.price && <p className="text-xs text-destructive">{formState.errors.price.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Stock Quantity</Label>
                  <Input {...register('stock_quantity')} type="number" placeholder="0" className={inputClass} />
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

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Create Product</>}
              </Button>
              <button type="button" onClick={() => router.push('/dashboard')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                Discard Changes
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
