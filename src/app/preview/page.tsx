'use client';

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  IconBuildingBank,
  IconChartLine,
  IconUser,
  IconPlus,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconFlame,
} from '@tabler/icons-react';

const accounts = [
  {
    name: 'Fidelity 401(k)',
    institution: 'Fidelity',
    type: 'retirement',
    balance: 456789.12,
    change: 1.2,
  },
  { name: 'Chase Checking', institution: 'Chase', type: 'checking', balance: 12345.67, change: 0 },
  {
    name: 'Vanguard Brokerage',
    institution: 'Vanguard',
    type: 'brokerage',
    balance: 234567.89,
    change: -0.8,
  },
  {
    name: 'Schwab Roth IRA',
    institution: 'Schwab',
    type: 'retirement',
    balance: 89012.34,
    change: 2.1,
  },
  { name: 'Chase Credit Card', institution: 'Chase', type: 'credit', balance: -4567.89, change: 0 },
  {
    name: 'Marcus Savings',
    institution: 'Goldman Sachs',
    type: 'savings',
    balance: 50000.0,
    change: 0.03,
  },
];

const holdings = [
  {
    symbol: 'VTI',
    name: 'Vanguard Total Stock',
    shares: 150,
    price: 245.67,
    value: 36850.5,
    gain: 8234.12,
    pct: 4.2,
  },
  {
    symbol: 'VXUS',
    name: 'Vanguard Intl Stock',
    shares: 200,
    price: 58.23,
    value: 11646.0,
    gain: -1023.45,
    pct: -2.1,
  },
  {
    symbol: 'BND',
    name: 'Vanguard Total Bond',
    shares: 100,
    price: 72.45,
    value: 7245.0,
    gain: 123.0,
    pct: 0.3,
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    shares: 50,
    price: 198.5,
    value: 9925.0,
    gain: 3456.78,
    pct: 12.5,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    shares: 25,
    price: 175.23,
    value: 4380.75,
    gain: -234.56,
    pct: -1.8,
  },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function ChangeCell({ value }: { value: number }) {
  if (value === 0) return <span className="font-mono tabular-nums text-neutral">&mdash;</span>;
  const color = value > 0 ? 'text-gain' : 'text-loss';
  const prefix = value > 0 ? '+' : '';
  const Icon = value > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${color}`}>
      <Icon size={14} />
      {prefix}
      {value.toFixed(1)}%
    </span>
  );
}

function GainCell({ value }: { value: number }) {
  const color = value > 0 ? 'text-gain' : value < 0 ? 'text-loss' : 'text-neutral';
  const prefix = value > 0 ? '+' : '';
  return (
    <span className={`font-mono tabular-nums ${color}`}>
      {prefix}
      {fmt(value)}
    </span>
  );
}

const orangeOptions = [
  {
    name: 'A — Amber 500',
    dark: { primary: '#f59e0b', ring: '#f59e0b', primaryFg: '#09090b' },
    light: { primary: '#d97706', ring: '#d97706', primaryFg: '#ffffff' },
    desc: 'Warm gold, premium feel',
  },
  {
    name: 'B — Orange 500',
    dark: { primary: '#f97316', ring: '#f97316', primaryFg: '#09090b' },
    light: { primary: '#ea580c', ring: '#ea580c', primaryFg: '#ffffff' },
    desc: 'True orange, bold & classic fire',
  },
  {
    name: 'C — Orange 400',
    dark: { primary: '#fb923c', ring: '#fb923c', primaryFg: '#09090b' },
    light: { primary: '#ea580c', ring: '#ea580c', primaryFg: '#ffffff' },
    desc: 'Soft orange, better contrast on dark',
  },
  {
    name: 'D — Amber 400',
    dark: { primary: '#fbbf24', ring: '#fbbf24', primaryFg: '#09090b' },
    light: { primary: '#f59e0b', ring: '#f59e0b', primaryFg: '#09090b' },
    desc: 'Golden, luxury feel',
  },
  {
    name: 'E — Ember custom',
    dark: { primary: '#f97048', ring: '#f97048', primaryFg: '#09090b' },
    light: { primary: '#e8571d', ring: '#e8571d', primaryFg: '#ffffff' },
    desc: 'Red-orange, literal ember glow',
  },
  {
    name: 'F — Copper',
    dark: { primary: '#e8915a', ring: '#e8915a', primaryFg: '#09090b' },
    light: { primary: '#c06a30', ring: '#c06a30', primaryFg: '#ffffff' },
    desc: 'Muted copper, understated warmth',
  },
];

function applyColorOption(option: (typeof orangeOptions)[number]) {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  const colors = isDark ? option.dark : option.light;
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--ring', colors.ring);
  root.style.setProperty('--primary-foreground', colors.primaryFg);
  root.style.setProperty('--sidebar-primary', colors.primary);
  root.style.setProperty('--sidebar-ring', colors.ring);
}

export default function PreviewPage() {
  const [tab, setTab] = useState<'home' | 'accounts' | 'investments' | 'forms'>('home');
  const [activeColor, setActiveColor] = useState<string | null>(null);

  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-card">
        <div className="p-6">
          <button
            onClick={() => setTab('home')}
            className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            <IconFlame size={22} className="text-primary" />
            Ember
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {[
            { id: 'home' as const, label: 'Home', icon: IconFlame },
            { id: 'accounts' as const, label: 'Accounts', icon: IconBuildingBank },
            { id: 'investments' as const, label: 'Investments', icon: IconChartLine },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <item.icon size={20} stroke={1.5} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-border/50 px-3 py-3">
          <button
            onClick={() => setTab('forms')}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'forms'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <IconUser size={20} stroke={1.5} />
            Profile
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Color switcher bar */}
        <div className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur px-6 py-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
            Accent color — click to preview live
          </p>
          <div className="flex flex-wrap gap-2">
            {orangeOptions.map((opt) => (
              <button
                key={opt.name}
                onClick={() => {
                  applyColorOption(opt);
                  setActiveColor(opt.name);
                }}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  activeColor === opt.name
                    ? 'border-foreground bg-muted text-foreground'
                    : 'border-border hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <span
                  className="h-4 w-4 rounded-sm shrink-0"
                  style={{ backgroundColor: opt.dark.primary }}
                />
                <span className="font-medium">{opt.name}</span>
                <span className="hidden sm:inline text-muted-foreground">— {opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-6">
          {tab === 'home' && <HomeTab netWorth={netWorth} />}
          {tab === 'accounts' && <AccountsTab />}
          {tab === 'investments' && <InvestmentsTab />}
          {tab === 'forms' && <FormsTab />}
        </div>
      </main>
    </div>
  );
}

function HomeTab({ netWorth }: { netWorth: number }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Home</h1>

      {/* Net worth hero */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth</CardTitle>
          <CardDescription>All accounts combined</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums font-mono">{fmt(netWorth)}</p>
              <p className="mt-1 text-sm text-gain font-mono tabular-nums">
                +$12,345.67 (+1.5%) this month
              </p>
            </div>
            <div className="flex h-40 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
              Area chart placeholder
            </div>
            <div className="flex gap-2">
              {['1M', '3M', 'YTD', '1Y', 'All'].map((r) => (
                <Button key={r} variant={r === '1Y' ? 'default' : 'secondary'} size="sm">
                  {r}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts summary */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.name}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.institution}</TableCell>
                  <TableCell className="capitalize">{a.type}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmt(a.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell value={a.change} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Button>
          <IconPlus size={16} data-icon="inline-start" />
          Add Account
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.name}>
            <CardHeader>
              <CardTitle>{a.name}</CardTitle>
              <CardDescription>
                {a.institution} &middot; {a.type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold font-mono tabular-nums">{fmt(a.balance)}</p>
              <p className="mt-1 text-sm">
                <ChangeCell value={a.change} />
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InvestmentsTab() {
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalGain = holdings.reduce((s, h) => s + h.gain, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Investments</h1>

      {/* Summary cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Value</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold font-mono tabular-nums">{fmt(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Gain/Loss</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold font-mono tabular-nums">
              <GainCell value={totalGain} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Allocation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-16 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
              Donut chart placeholder
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holdings table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => (
                <TableRow key={h.symbol}>
                  <TableCell className="font-medium font-mono">{h.symbol}</TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{h.shares}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmt(h.price)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmt(h.value)}
                  </TableCell>
                  <TableCell className="text-right">
                    <GainCell value={h.gain} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell value={h.pct} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FormsTab() {
  const [previewTheme, setPreviewTheme] = useState<'system' | 'light' | 'dark'>('dark');

  function switchTheme(t: 'system' | 'light' | 'dark') {
    setPreviewTheme(t);
    const root = document.documentElement;
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', t === 'dark');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTheme(t)}
                className={`rounded-md px-4 py-2.5 text-sm font-medium transition-colors capitalize ${
                  previewTheme === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Display Name</label>
              <Input defaultValue="Adam" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input defaultValue="adam@example.com" type="email" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Target Retirement Age</label>
              <Input defaultValue="55" type="number" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Risk Tolerance</label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50">
                <option>Conservative</option>
                <option>Moderate</option>
                <option selected>Aggressive</option>
              </select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="secondary">Cancel</Button>
          <Button className="ml-2">Save</Button>
        </CardFooter>
      </Card>

      {/* Color swatches */}
      <Card>
        <CardHeader>
          <CardTitle>Design System</CardTitle>
          <CardDescription>Color tokens and component variants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Accent color */}
            <div>
              <p className="text-sm font-medium mb-3">Accent / Primary</p>
              <div className="flex gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary" title="primary" />
                <div className="h-12 w-12 rounded-lg bg-primary/80" title="primary/80" />
                <div className="h-12 w-12 rounded-lg bg-primary/60" title="primary/60" />
                <div className="h-12 w-12 rounded-lg bg-primary/40" title="primary/40" />
                <div className="h-12 w-12 rounded-lg bg-primary/20" title="primary/20" />
              </div>
            </div>

            {/* Surfaces */}
            <div>
              <p className="text-sm font-medium mb-3">Surfaces</p>
              <div className="flex gap-3">
                <div className="h-12 w-24 rounded-lg bg-background border border-border flex items-center justify-center text-xs text-muted-foreground">
                  Page
                </div>
                <div className="h-12 w-24 rounded-lg bg-card flex items-center justify-center text-xs text-muted-foreground">
                  Card
                </div>
                <div className="h-12 w-24 rounded-lg bg-popover shadow-md flex items-center justify-center text-xs text-muted-foreground">
                  Popover
                </div>
                <div className="h-12 w-24 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  Muted
                </div>
              </div>
            </div>

            {/* Finance colors */}
            <div>
              <p className="text-sm font-medium mb-3">Finance</p>
              <div className="flex gap-4 text-sm">
                <span className="text-gain font-mono">+$1,234.56</span>
                <span className="text-loss font-mono">-$789.01</span>
                <span className="text-neutral font-mono">&mdash;</span>
              </div>
            </div>

            {/* Buttons */}
            <div>
              <p className="text-sm font-medium mb-3">Buttons</p>
              <div className="flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>

            {/* Chart colors */}
            <div>
              <p className="text-sm font-medium mb-3">Asset Class Colors</p>
              <div className="flex gap-3">
                {[
                  { label: 'Equity', color: 'bg-chart-equity' },
                  { label: 'Fixed', color: 'bg-chart-fixed-income' },
                  { label: 'Cash', color: 'bg-chart-cash' },
                  { label: 'Real Estate', color: 'bg-chart-real-estate' },
                  { label: 'Crypto', color: 'bg-chart-crypto' },
                  { label: 'Commodity', color: 'bg-chart-commodity' },
                  { label: 'Other', color: 'bg-chart-other' },
                ].map((c) => (
                  <div key={c.label} className="text-center">
                    <div className={`h-8 w-8 rounded ${c.color} mx-auto`} />
                    <span className="text-xs text-muted-foreground mt-1 block">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
