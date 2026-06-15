'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import {
  Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw,
  Loader2, AlertCircle, DollarSign, Target, Lightbulb, Sun,
  Flame, Snowflake, Package, BarChart2, ChevronRight, Info,
  ArrowUpRight, ArrowDownRight, Minus as MinusIcon, Star, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, Legend,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

interface DemandPrediction {
  product: string;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  reason: string;
  sales_likelihood?: 'high' | 'low' | 'none';
  demand_score?: number;
  predicted_volume?: number;
  unit?: string;
}
interface SeasonalOpportunity { title: string; description: string; potential_revenue: number; action: string; }
interface RevenueForecast { next_month: number; next_quarter: number; growth_rate: number; currency: string; }
interface Recommendation { title: string; description: string; priority: 'high' | 'medium' | 'low'; }
interface KeyExplanation {
  point: string;
  impact: string;
  recommendation: string;
}

interface ForecastData {
  demand_predictions: DemandPrediction[];
  seasonal_opportunities: SeasonalOpportunity[];
  revenue_forecast: RevenueForecast;
  recommendations: Recommendation[];
  key_explanations?: KeyExplanation[];
  seasonal_insight: string;
}

const LOADING_PHRASES = [
  'Retrieving your sales ledger...',
  'Compiling active product catalog...',
  'Reading past seasonal trade trends...',
  'Consulting Gemini 2.5 Flash...',
  'Crunching regional market demands...',
  'Generating product recommendations...',
  'Finalizing revenue forecasts...'
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-orange-100 text-orange-700',
  low: 'bg-blue-100 text-blue-700',
};

// Custom tooltip for bar chart
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border/60 rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="text-xs">
            {p.name}: <span className="font-bold">{p.value}{p.name === 'Demand Score' ? '/100' : ''}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Product performance summary badge color
function getLikelihoodColor(likelihood?: string) {
  if (likelihood === 'high') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (likelihood === 'low') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function getLikelihoodLabel(likelihood?: string) {
  if (likelihood === 'high') return 'High Sales';
  if (likelihood === 'low') return 'Low Sales';
  return 'No Sales';
}

function getTrendIcon(trend: string) {
  if (trend === 'up') return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
  if (trend === 'down') return <ArrowDownRight className="w-4 h-4 text-red-500" />;
  return <MinusIcon className="w-4 h-4 text-muted-foreground" />;
}

function getDemandBarColor(score: number) {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export default function ForecastsPage() {
  const { user } = useAuth();
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  useEffect(() => {
    let interval: any;
    if (generating) {
      setLoadingPhraseIndex(0);
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [generating]);

  const loadCachedForecast = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_predictions')
      .select('*')
      .eq('seller_id', user.id)
      .eq('prediction_type', 'seasonal_forecast')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setForecast(data.prediction_data as ForecastData);
      setLastGenerated(data.created_at);
    }
    setLoading(false);
  };

  useEffect(() => { loadCachedForecast(); }, [user]);

  const generateForecast = async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/gemini/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate forecast');
      }
      const data: ForecastData = await res.json();
      setForecast(data);
      setLastGenerated(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Failed to generate forecast. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Derived data
  const hotProducts = forecast?.demand_predictions.filter(p => p.sales_likelihood === 'high') ?? [];
  const slowProducts = forecast?.demand_predictions.filter(p => p.sales_likelihood === 'low' || p.sales_likelihood === 'none') ?? [];

  const demandChartData = forecast?.demand_predictions
    .slice()
    .sort((a, b) => (b.demand_score ?? b.confidence) - (a.demand_score ?? a.confidence))
    .map(p => ({
      name: p.product,
      'Demand Score': p.demand_score ?? p.confidence,
      Confidence: p.confidence,
      likelihood: p.sales_likelihood,
    })) ?? [];

  const volumeChartData = forecast?.demand_predictions
    .filter(p => (p.predicted_volume ?? 0) > 0)
    .map(p => ({
      name: p.product,
      Volume: p.predicted_volume ?? 0,
      unit: p.unit ?? 'units',
    })) ?? [];

  const quarterlyChartData = forecast ? [
    { period: 'This Month', revenue: forecast.revenue_forecast.next_month },
    {
      period: 'Month 2',
      revenue: Math.round(forecast.revenue_forecast.next_month * (1 + forecast.revenue_forecast.growth_rate / 200)),
    },
    { period: 'Quarter Total', revenue: forecast.revenue_forecast.next_quarter },
  ] : [];

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold">Product Forecast</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            AI-powered, product-centric predictions for next season — powered by Gemini 2.5
            {lastGenerated && (
              <span className="ml-2 text-muted-foreground/70">
                · Updated {formatDistanceToNow(new Date(lastGenerated), { addSuffix: true })}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={generateForecast}
          disabled={generating}
          className="rounded-xl h-10 bg-primary gap-2 shrink-0"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> {forecast ? 'Refresh' : 'Generate Forecast'}</>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Empty state */}
      {!forecast && !generating && (
        <div className="bg-white rounded-2xl border border-border/40 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">No forecast yet</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Generate your first AI-powered sales forecast to see which products will dominate next season and which to watch out for.
          </p>
          <Button onClick={generateForecast} className="rounded-xl bg-primary gap-2">
            <Sparkles className="w-4 h-4" /> Generate My First Forecast
          </Button>
        </div>
      )}

      {/* Loading state */}
      {generating && !forecast && (
        <div className="bg-white rounded-2xl border border-border/40 p-16 text-center relative overflow-hidden animate-in fade-in duration-300">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-2 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Analyzing Market Data</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Please wait while Gemini AI analyzes your product portfolio, historical orders, and seasonal trends.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/40 text-primary font-medium text-xs rounded-full animate-pulse transition-all duration-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {LOADING_PHRASES[loadingPhraseIndex]}
          </div>
          <div className="w-64 bg-muted h-1.5 rounded-full mx-auto mt-6 overflow-hidden relative">
            <div className="bg-primary h-full absolute left-0 top-0 animate-[progress_15s_ease-out_infinite]" style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {forecast && (
        <>
          {/* Seasonal Insight Banner */}
          <div className="bg-gradient-to-br from-primary to-primary/80 text-white rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sun className="w-5 h-5 text-yellow-300" />
              <span className="font-semibold text-sm text-white/80 uppercase tracking-wide">Seasonal Market Insight</span>
            </div>
            <p className="text-base leading-relaxed">{forecast.seasonal_insight}</p>
          </div>

          {/* Revenue KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Next Month Forecast', value: `₦${forecast.revenue_forecast.next_month.toLocaleString()}`, icon: <DollarSign className="w-5 h-5" />, sub: 'Projected monthly revenue' },
              { label: 'Quarterly Forecast', value: `₦${forecast.revenue_forecast.next_quarter.toLocaleString()}`, icon: <Target className="w-5 h-5" />, sub: '3-month outlook' },
              { label: 'Projected Growth', value: `+${forecast.revenue_forecast.growth_rate}%`, icon: <TrendingUp className="w-5 h-5 text-green-500" />, sub: 'vs previous quarter' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-border/40 p-5">
                <div className="w-10 h-10 rounded-xl bg-accent/60 flex items-center justify-center text-primary mb-4">{card.icon}</div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">{card.label}</p>
                <p className="text-2xl font-bold mb-0.5">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ====== HOT PRODUCTS ====== */}
          {hotProducts.length > 0 && (
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">Products That Will Sell More</h2>
                  <p className="text-xs text-muted-foreground">High demand — prioritise stocking these</p>
                </div>
                <Badge className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs rounded-full px-3">
                  {hotProducts.length} product{hotProducts.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {hotProducts.map((prod, i) => (
                  <div
                    key={i}
                    className="group relative rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
                  >
                    {/* Score pill */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-2 py-0.5">
                      <Star className="w-3 h-3" /> {prod.demand_score ?? prod.confidence}
                    </div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{prod.product}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {getTrendIcon(prod.trend)}
                          <span className="text-xs text-muted-foreground capitalize">{prod.trend} trend</span>
                        </div>
                      </div>
                    </div>

                    {/* Demand bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Demand Index</span>
                        <span className="font-semibold text-foreground">{prod.demand_score ?? prod.confidence}/100</span>
                      </div>
                      <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${prod.demand_score ?? prod.confidence}%` }}
                        />
                      </div>
                    </div>

                    {/* Volume */}
                    {prod.predicted_volume != null && prod.predicted_volume > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1 w-fit">
                        <Zap className="w-3 h-3" />
                        <span>~{prod.predicted_volume.toLocaleString()} {prod.unit ?? 'units'} expected</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground leading-relaxed">{prod.reason}</p>

                    <div className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600">
                      <span>{prod.confidence}% AI confidence</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ====== SLOW / NO SALES PRODUCTS ====== */}
          {slowProducts.length > 0 && (
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Snowflake className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">Products That Won&apos;t Sell Much</h2>
                  <p className="text-xs text-muted-foreground">Low or no demand expected — reduce stock or pivot strategy</p>
                </div>
                <Badge className="ml-auto bg-amber-50 text-amber-700 border-amber-200 border text-xs rounded-full px-3">
                  {slowProducts.length} product{slowProducts.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {slowProducts.map((prod, i) => {
                  const isNone = prod.sales_likelihood === 'none';
                  return (
                    <div
                      key={i}
                      className={cn(
                        'group relative rounded-xl border p-4 transition-all hover:shadow-sm',
                        isNone
                          ? 'border-red-100 bg-gradient-to-br from-red-50/50 to-white hover:border-red-200'
                          : 'border-amber-100 bg-gradient-to-br from-amber-50/40 to-white hover:border-amber-200'
                      )}
                    >
                      <div className={cn(
                        'absolute top-3 right-3 text-xs font-bold rounded-full px-2 py-0.5',
                        isNone ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {prod.demand_score ?? prod.confidence}/100
                      </div>
                      <div className="flex items-start gap-3 mb-3">
                        <div className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                          isNone ? 'bg-red-100' : 'bg-amber-100'
                        )}>
                          <Package className={cn('w-4 h-4', isNone ? 'text-red-500' : 'text-amber-600')} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{prod.product}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {getTrendIcon(prod.trend)}
                            <span className="text-xs text-muted-foreground capitalize">{prod.trend} trend</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Demand Index</span>
                          <span className="font-semibold text-foreground">{prod.demand_score ?? prod.confidence}/100</span>
                        </div>
                        <div className={cn('h-2 rounded-full overflow-hidden', isNone ? 'bg-red-100' : 'bg-amber-100')}>
                          <div
                            className={cn('h-full rounded-full transition-all duration-700', isNone ? 'bg-red-400' : 'bg-amber-400')}
                            style={{ width: `${prod.demand_score ?? prod.confidence}%` }}
                          />
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn('text-xs rounded-full border mb-2', getLikelihoodColor(prod.sales_likelihood))}
                      >
                        {getLikelihoodLabel(prod.sales_likelihood)}
                      </Badge>

                      <p className="text-xs text-muted-foreground leading-relaxed">{prod.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ====== CHARTS SECTION ====== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Demand Score Bar Chart */}
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-base">Product Demand Index</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Next-season demand score per product (0–100)</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={demandChartData} margin={{ top: 4, right: 4, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="Demand Score" radius={[5, 5, 0, 0]}>
                    {demandChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getDemandBarColor(entry['Demand Score'])}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 justify-center flex-wrap">
                {[
                  { color: '#10b981', label: 'High demand (70+)' },
                  { color: '#f59e0b', label: 'Medium (40–69)' },
                  { color: '#ef4444', label: 'Low (<40)' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Forecast Bar Chart */}
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-base">Revenue Forecast</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Projected revenue over the next quarter (₦)</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={quarterlyChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: any) => [`₦${Number(v || 0).toLocaleString()}`, 'Forecast Revenue']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" fill="hsl(152 63% 25%)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Predicted Volume Chart */}
          {volumeChartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-base">Predicted Sales Volume</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                Estimated units/quantities expected to be sold per product next season
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={volumeChartData} margin={{ top: 4, right: 4, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any, _: any, props: any) => [
                      `${Number(v).toLocaleString()} ${props?.payload?.unit ?? 'units'}`,
                      'Predicted Volume',
                    ]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="Volume" fill="#6366f1" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ====== FULL PRODUCT TABLE ====== */}
          <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
            <div className="p-6 pb-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-base">Full Product Analysis</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Complete breakdown of all forecast metrics per product</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-semibold">Product</th>
                    <th className="text-center px-4 py-3 font-semibold">Trend</th>
                    <th className="text-center px-4 py-3 font-semibold">Demand Score</th>
                    <th className="text-center px-4 py-3 font-semibold">Confidence</th>
                    <th className="text-center px-4 py-3 font-semibold">Est. Volume</th>
                    <th className="text-center px-4 py-3 font-semibold">Sales Outlook</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {forecast.demand_predictions.map((prod, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{prod.product}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex justify-center">{getTrendIcon(prod.trend)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${prod.demand_score ?? prod.confidence}%`,
                                background: getDemandBarColor(prod.demand_score ?? prod.confidence),
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground">{prod.demand_score ?? prod.confidence}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-medium text-muted-foreground">
                        {prod.confidence}%
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-muted-foreground">
                        {prod.predicted_volume
                          ? `${prod.predicted_volume.toLocaleString()} ${prod.unit ?? 'units'}`
                          : '—'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn(
                          'inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                          getLikelihoodColor(prod.sales_likelihood)
                        )}>
                          {getLikelihoodLabel(prod.sales_likelihood)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ====== KEY EXPLANATIONS ====== */}
          {forecast.key_explanations && forecast.key_explanations.length > 0 && (
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Info className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Why These Predictions?</h2>
                  <p className="text-xs text-muted-foreground">Key market drivers & what they mean for you</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecast.key_explanations.map((item, i) => (
                  <div key={i} className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0 font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="font-bold text-sm text-foreground">{item.point}</p>
                    </div>
                    <div className="pl-7 space-y-1.5 text-xs">
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground/80">Market Impact: </span>
                        {item.impact}
                      </p>
                      <p className="text-primary font-medium">
                        💡 <span className="font-bold">Action: </span>{item.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ====== SEASONAL OPPORTUNITIES ====== */}
          <div className="bg-white rounded-2xl border border-border/40 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="font-bold text-base">Seasonal Opportunities</h2>
                <p className="text-xs text-muted-foreground">High-potential revenue windows to act on now</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {forecast.seasonal_opportunities.map((opp, i) => (
                <div key={i} className="p-4 bg-gradient-to-br from-violet-50/50 to-white rounded-xl border border-violet-100 hover:border-violet-200 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-sm">{opp.title}</span>
                    <span className="text-xs font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                      +₦{opp.potential_revenue.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{opp.description}</p>
                  <div className="flex items-center gap-1 text-xs font-medium text-violet-700">
                    <ChevronRight className="w-3 h-3" />
                    {opp.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ====== AI RECOMMENDATIONS ====== */}
          <div className="bg-white rounded-2xl border border-border/40 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-yellow-50 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <h2 className="font-bold text-base">AI Recommendations</h2>
                <p className="text-xs text-muted-foreground">Actionable steps based on your forecast</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {forecast.recommendations.map((rec, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/40 hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={cn('text-xs border-0 rounded-full', PRIORITY_COLORS[rec.priority])}>
                      {rec.priority} priority
                    </Badge>
                  </div>
                  <p className="font-semibold text-sm mb-1">{rec.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
