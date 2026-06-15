import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { useMemo } from 'react';

export function Footer() {
  const date = useMemo(() => new Date(),[]);
  return (
    <footer className="bg-white border-t border-border/60 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Leaf className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-primary text-base">AgriMarket AI</span>
            </div>
            <p className="text-xs text-muted-foreground">© {date.getFullYear()} AgriMarket AI. Sustainable Trade for Modern Farmers.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
