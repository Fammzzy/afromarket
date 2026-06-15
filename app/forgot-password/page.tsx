'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Leaf, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[#f5f7f5] flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-md">
          <Leaf className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary tracking-tight">AgriMarket AI</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border/40 w-full max-w-md p-8">
        <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Check your email</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We sent a password reset link to your email address. Please check your inbox and follow the instructions.
            </p>
            <Link href="/login">
              <Button className="mt-6 rounded-xl h-11 bg-primary hover:bg-primary/90">Back to Login</Button>
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-1">Reset your password</h2>
            <p className="text-muted-foreground text-sm mb-6">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email Address</Label>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="name@example.com"
                  className="h-12 bg-[#f0f4f0] border-transparent focus:bg-white focus:border-primary/30 rounded-xl"
                  disabled={formState.isSubmitting}
                />
                {formState.errors.email && (
                  <p className="text-xs text-destructive">{formState.errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold"
                disabled={formState.isSubmitting}
              >
                {formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
