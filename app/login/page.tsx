'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(8, 'Please enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
  terms: z.boolean().refine(v => v, 'You must accept the terms'),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const labels = ['None', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-gray-200', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

  if (!password) return null;

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? colors[strength] : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        PASSWORD STRENGTH: <span className="font-semibold">{labels[strength].toUpperCase()}</span>
      </p>
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      terms: false,
    },
  });

  const password = registerForm.watch('password') ?? '';

  const isAnyLoading = googleLoading || signInLoading || signUpLoading;

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { toast.error(error.message); setGoogleLoading(false); }
  };

  const onLogin = async (data: LoginForm) => {
    setSignInLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) { 
        toast.error(error.message); 
        setSignInLoading(false); 
        return; 
      }
      toast.success('Welcome back!');
      router.push('/marketplace');
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong during sign in');
      setSignInLoading(false);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setSignUpLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, phone_number: data.phone },
        },
      });
      if (error) { 
        toast.error(error.message); 
        setSignUpLoading(false); 
        return; 
      }

      if (authData.user) {
        await supabase.from('users').upsert({
          id: authData.user.id,
          email: data.email,
          full_name: data.full_name,
          phone_number: data.phone,
        });
      }
      toast.success('Account created! Welcome to AgriMarket AI.');
      router.push('/marketplace');
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong during registration');
      setSignUpLoading(false);
    }
  };

  const inputClass = "h-12 bg-[#f0f4f0] border-transparent focus:bg-white focus:border-primary/30 rounded-xl transition-all";

  return (
    <div className="min-h-screen bg-[#f5f7f5] flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-md">
          <Leaf className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary tracking-tight">AgriMarket AI</h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Smarter Farming, Brighter Future.<br />Join 12,000+ farmers worldwide.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border/40 w-full max-w-md p-8">
        <Tabs value={tab} onValueChange={v => !isAnyLoading && setTab(v as 'login' | 'register')}>
          <TabsList className="w-full grid grid-cols-2 bg-transparent border-b border-border rounded-none mb-6 h-auto p-0">
            <TabsTrigger
              value="login"
              disabled={isAnyLoading}
              className="pb-3 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground font-medium text-sm transition-all"
            >Login</TabsTrigger>
            <TabsTrigger
              value="register"
              disabled={isAnyLoading}
              className="pb-3 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground font-medium text-sm transition-all"
            >Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-0">
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email Address</Label>
                <Input {...loginForm.register('email')} type="email" placeholder="name@example.com" className={inputClass} disabled={isAnyLoading} />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Input
                    {...loginForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                    disabled={isAnyLoading}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isAnyLoading} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={loginForm.watch('remember')}
                  onCheckedChange={v => loginForm.setValue('remember', !!v)}
                  disabled={isAnyLoading}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Remember me for 30 days</Label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-base"
                disabled={isAnyLoading}
              >
                {signInLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
              </Button>
            </form>
          </TabsContent>

          {/* REGISTER TAB */}
          <TabsContent value="register" className="mt-0">
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Full Name</Label>
                <Input {...registerForm.register('full_name')} placeholder="John Doe" className={inputClass} disabled={isAnyLoading} />
                {registerForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Email</Label>
                  <Input {...registerForm.register('email')} type="email" placeholder="john@doe.com" className={inputClass} disabled={isAnyLoading} />
                  {registerForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Phone</Label>
                  <Input {...registerForm.register('phone')} type="tel" placeholder="+1 (555) 000-0000" className={inputClass} disabled={isAnyLoading} />
                  {registerForm.formState.errors.phone && (
                    <p className="text-xs text-destructive">{registerForm.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Create Password</Label>
                <div className="relative">
                  <Input
                    {...registerForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                    disabled={isAnyLoading}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isAnyLoading} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
                {registerForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Confirm Password</Label>
                <div className="relative">
                  <Input
                    {...registerForm.register('confirm_password')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                    disabled={isAnyLoading}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isAnyLoading} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {registerForm.formState.errors.confirm_password && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.confirm_password.message}</p>
                )}
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="terms" className="mt-0.5" onCheckedChange={v => registerForm.setValue('terms', !!v)} disabled={isAnyLoading} />
                <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                  I agree to the{' '}
                  <Link href="/terms" className="text-primary hover:underline">Terms</Link>{' '}and{' '}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </Label>
              </div>
              {registerForm.formState.errors.terms && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.terms.message}</p>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-base"
                disabled={isAnyLoading}
              >
                {signUpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button type="button" onClick={() => setTab('login')} className="text-primary hover:underline font-medium">Log In</button>
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
          By joining, you agree to receive automated communications from AgriMarket AI. Standard rates apply.
        </p>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">© 2024 AgriMarket AI. Secure & Verified Platform.</p>
    </div>
  );
}
