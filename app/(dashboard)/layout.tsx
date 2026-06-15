'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Package, BarChart2, Sparkles, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SIDEBAR_LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/products', label: 'Products', icon: Package, exact: false },
  { href: '/dashboard/sales', label: 'Sales', icon: ShoppingBag, exact: false },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2, exact: false },
  { href: '/dashboard/forecasts', label: 'AI Forecasts', icon: Sparkles, exact: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf8]">
      <Navbar />
      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="bg-white rounded-2xl border border-border/40 p-3 sticky top-24">
            <nav className="space-y-0.5">
              {SIDEBAR_LINKS.map(link => {
                const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/dashboard/products/new">
                <Button size="sm" className="w-full rounded-xl h-9 bg-primary gap-1.5 text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5" /> New Product
                </Button>
              </Link>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
