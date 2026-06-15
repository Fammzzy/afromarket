'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera, Loader2, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import Link from 'next/link';

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone_number: z.string().optional(),
  location: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone_number: profile?.phone_number ?? '',
      location: profile?.location ?? '',
    },
  });

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from('profile-images')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error) { toast.error('Failed to upload avatar'); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('profile-images').getPublicUrl(path);
    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
    await refreshProfile();
    toast.success('Avatar updated!');
    setUploading(false);
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    const { error } = await supabase.from('users').update({
      full_name: data.full_name,
      phone_number: data.phone_number ?? '',
      location: data.location ?? '',
    }).eq('id', user.id);

    if (error) { toast.error('Failed to update profile'); return; }
    await refreshProfile();
    toast.success('Profile updated!');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Link href="/login"><Button className="rounded-xl bg-primary">Sign In</Button></Link>
      </div>
    );
  }

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';
  const inputClass = 'h-11 bg-muted/40 border-border/60 rounded-xl focus:bg-white';

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf8]">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">My Profile</h1>

        <div className="bg-white rounded-2xl border border-border/40 p-6 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
              />
            </div>
            <div>
              <p className="font-bold text-lg">{profile?.full_name || 'Your Name'}</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">Click the camera icon to update your photo</p>
            </div>
          </div>

          <div className="border-t border-border/40 pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Full Name</Label>
                <Input {...register('full_name')} className={inputClass} />
                {formState.errors.full_name && <p className="text-xs text-destructive">{formState.errors.full_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email</Label>
                <Input value={user.email ?? ''} disabled className={`${inputClass} opacity-60`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Phone Number</Label>
                  <Input {...register('phone_number')} type="tel" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Location</Label>
                  <Input {...register('location')} placeholder="City, State" className={inputClass} />
                </div>
              </div>
              <Button type="submit" disabled={formState.isSubmitting} className="w-full h-11 rounded-xl bg-primary gap-2">
                {formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
