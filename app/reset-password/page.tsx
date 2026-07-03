'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) { 
        toast.error(error.message); 
        setSubmitting(false); 
        return; 
      }
      toast.success('Password updated successfully!');
      router.push('/login');
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong during password update');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7f5] flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-md">
          <Leaf className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary tracking-tight">AgriMarket</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border/40 w-full max-w-md p-8">
        <h2 className="text-2xl font-bold mb-1">Set new password</h2>
        <p className="text-muted-foreground text-sm mb-6">Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">New Password</Label>
            <div className="relative">
              <Input
                {...register('password')}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                className="h-12 bg-[#f0f4f0] border-transparent focus:bg-white focus:border-primary/30 rounded-xl pr-10"
                disabled={submitting}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} disabled={submitting} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formState.errors.password && (
              <p className="text-xs text-destructive">{formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Confirm Password</Label>
            <Input
              {...register('confirm_password')}
              type="password"
              placeholder="••••••••"
              className="h-12 bg-[#f0f4f0] border-transparent focus:bg-white focus:border-primary/30 rounded-xl"
              disabled={submitting}
            />
            {formState.errors.confirm_password && (
              <p className="text-xs text-destructive">{formState.errors.confirm_password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
