import React, { useState, useContext } from 'react';
import apiFetch from '../utils/apiFetch';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { sanitizeText, sanitizeNumber } from '../utils/displayValue';
import { formatCurrency } from '../utils/currency';
import {
  Search, TrendingUp, ShoppingBag, Store, Package,
  ArrowDownLeft, ArrowUpRight, ClipboardList, MoveRight,
  AlertTriangle, PackageX, Zap, BarChart2, Activity,
  CheckCircle, Clock, Box
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';

/* ── Custom Tooltip ── */
const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
      fontSize: '12px'
    }}>
      {label && <p style={{ color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>{label}</p>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: p.color, fontWeight: '700', margin: '2px 0' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span>{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Gradient KPI Card ── */
function KpiCard({ icon: Icon, label, value, sub, gradient, iconBg, iconColor, accent }) {
  return (
    <div style={{
      borderRadius: '16px',
      padding: '20px',
      background: gradient || 'var(--bg-surface)',
      border: `1px solid ${accent || 'var(--bg-border)'}`,
      boxShadow: `0 4px 24px -4px ${accent ? accent + '33' : 'rgba(0,0,0,0.06)'}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px -4px ${accent ? accent + '44' : 'rgba(0,0,0,0.1)'}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 24px -4px ${accent ? accent + '33' : 'rgba(0,0,0,0.06)'}`; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px',
          background: iconBg || 'rgba(99,102,241,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Icon size={20} color={iconColor || '#6366f1'} />
        </div>
        <span style={{
          fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
          letterSpacing: '0.06em', color: iconColor || '#6366f1',
          background: iconBg || 'rgba(99,102,241,0.08)',
          padding: '3px 8px', borderRadius: '999px'
        }}>{sub}</span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{label}</p>
        <h3 style={{ margin: '4px 0 0', fontSize: 'clamp(1.3rem, 2vw, 1.8rem)', fontWeight: '900', color: 'var(--text-main)', lineHeight: 1.1 }}>{value}</h3>
      </div>
    </div>
  );
}

/* ── Section Card wrapper ── */
function SectionCard({ title, subtitle, badge, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--bg-border)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      ...style
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>{title}</h4>
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ── Quick Action Button ── */
function QuickAction({ icon: Icon, label, desc, color, bg, border, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 14px', borderRadius: '12px',
        border: `1px solid ${border}`, background: bg,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'all 0.18s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${border}66`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: border + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '700', color }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{desc}</div>
      </div>
    </button>
  );
}

export default function Dashboard({ onQuickStockIn, onQuickStockOut, onOpenRequests, onOpenTransfers }) {
  const { stats = {}, materials = [], transactions = [] } = useContext(DataContext) || {};
  const { currentUser } = useContext(AuthContext) || {};

  const safeMaterials = Array.isArray(materials) ? materials : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeStats = stats || {};

  const role = currentUser?.role || '';
  const canViewCost = ['Director', 'Administrator', 'Manager'].includes(role);
  const userName = currentUser?.full_name?.trim().split(' ')[0] || currentUser?.username || '';

  // ── Metrics ────────────────────────────────────────────────
  const totalMaterialsCount = Number(safeStats.totalMaterials ?? safeMaterials.length);
  const pendingOrdersCount  = Number(safeStats.pendingOrders ?? 0);
  const departmentsCount    = Number(safeStats.departments ?? 0);
  const totalInventoryValue = safeMaterials.reduce((s, m) => s + sanitizeNumber(m.current_stock) * sanitizeNumber(m.unit_cost), 0);
  const lowStockItems  = safeMaterials.filter(m => sanitizeNumber(m.current_stock) <= sanitizeNumber(m.min_stock_level) && sanitizeNumber(m.current_stock) > 0);
  const outOfStockItems = safeMaterials.filter(m => sanitizeNumber(m.current_stock) === 0);
  const lowStockCount  = Number(safeStats.lowStockCount ?? lowStockItems.length);
  const outOfStockCount = outOfStockItems.length;
  const stockHealthPercent = totalMaterialsCount > 0
    ? Math.round(((totalMaterialsCount - lowStockCount - outOfStockCount) / totalMaterialsCount) * 100)
    : 0;
  const totalUnits = safeMaterials.reduce((s, m) => s + sanitizeNumber(m.current_stock), 0);

  // Most-issued
  const issuedByMaterial = {};
  safeTransactions.forEach(tx => {
    if (tx.transaction_type === 'STOCK_OUT') {
      const key = tx.material_name || tx.material_code || `#${tx.material_id}`;
      issuedByMaterial[key] = (issuedByMaterial[key] || 0) + sanitizeNumber(tx.quantity);
    }
  });
  const mostIssuedMaterials = Object.entries(issuedByMaterial)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Monthly movement – last 6 months
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString('en-US', { month: 'short' });
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inQty  = safeTransactions.filter(t => t.transaction_type === 'STOCK_IN'  && (t.transaction_date || '').startsWith(monthStr)).reduce((s, t) => s + sanitizeNumber(t.quantity), 0);
    const outQty = safeTransactions.filter(t => t.transaction_type === 'STOCK_OUT' && (t.transaction_date || '').startsWith(monthStr)).reduce((s, t) => s + sanitizeNumber(t.quantity), 0);
    return { label, in: inQty, out: outQty };
  });

  // Donut
  const donutPalette = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6'];
  const categoryStats = Array.isArray(safeStats.categoryStats) ? safeStats.categoryStats : [];
  const donutData = (categoryStats.length
    ? categoryStats.filter(e => Number(e.stock_qty || 0) > 0).slice(0, 6).map((e, i) => ({ name: sanitizeText(e.category, 'Uncategorized'), value: Number(e.stock_qty), color: donutPalette[i % donutPalette.length] }))
    : safeMaterials.slice(0, 6).map((m, i) => ({ name: sanitizeText(m.name, 'Unknown'), value: sanitizeNumber(m.current_stock), color: donutPalette[i % donutPalette.length] }))
  );

  // Recent transactions
  const recentTransactions = safeTransactions
    .slice().sort((a, b) => new Date(b.transaction_date || b.created_at || 0) - new Date(a.transaction_date || a.created_at || 0))
    .slice(0, 6);

  // Greeting
  const hour = now.getHours();
  const timeGreeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
  const greetEmoji   = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : hour < 21 ? '🌆' : '🌙';

  // Search
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchMaterials = dashboardSearch.trim()
    ? safeMaterials.filter(m => (m.name || '').toLowerCase().includes(dashboardSearch.toLowerCase()) || (m.material_code || '').toLowerCase().includes(dashboardSearch.toLowerCase())).slice(0, 5)
    : [];
  const searchTxns = dashboardSearch.trim()
    ? safeTransactions.filter(t => (t.transaction_code || '').toLowerCase().includes(dashboardSearch.toLowerCase()) || (t.material_name || '').toLowerCase().includes(dashboardSearch.toLowerCase())).slice(0, 4)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ══ HERO BANNER ══════════════════════════════════════════ */}
      <div style={{
        borderRadius: '20px',
        padding: '28px 28px 24px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1d4ed8 100%)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: '-60px', right: '80px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', right: '200px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(14,165,233,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20px', right: '20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(139,92,246,0.18)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          {/* Left: Avatar + Greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Profile"
                style={{ width: '72px', height: '72px', borderRadius: '18px', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }} />
            ) : (
              <div style={{
                width: '72px', height: '72px', borderRadius: '18px',
                background: 'linear-gradient(135deg, #818cf8, #38bdf8)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '900', fontSize: '28px',
                border: '3px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}>
                {userName ? userName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}>
                  {greetEmoji} Good {timeGreeting}
                </span>
                <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.15)', color: '#e0e7ff', padding: '2px 8px', borderRadius: '999px', fontWeight: '600' }}>
                  {role}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em' }}>
                {userName ? `Welcome back, ${userName}!` : 'Welcome back!'}
              </h2>
              <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Right: Search */}
          <div style={{ position: 'relative', width: 'clamp(220px, 30vw, 320px)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search materials, codes…"
                value={dashboardSearch}
                onChange={e => { setDashboardSearch(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                style={{
                  width: '100%', paddingLeft: '36px', paddingRight: dashboardSearch ? '32px' : '12px',
                  height: '40px', borderRadius: '12px', fontSize: '13px',
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', outline: 'none', backdropFilter: 'blur(8px)',
                }}
              />
              {dashboardSearch && (
                <button onClick={() => setDashboardSearch('')} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              )}
            </div>
            {showSearchDropdown && dashboardSearch.trim() && (searchMaterials.length > 0 || searchTxns.length > 0) && (
              <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', overflow: 'hidden', padding: '8px' }}>
                {searchMaterials.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Materials</div>
                    {searchMaterials.map(m => (
                      <div key={m.id} style={{ padding: '8px 10px', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div>
                          <strong style={{ color: 'var(--text-main)' }}>{m.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({m.material_code})</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981' }}>×{m.current_stock}</span>
                      </div>
                    ))}
                  </>
                )}
                {searchTxns.length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', padding: '6px 8px 4px', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: searchMaterials.length > 0 ? '1px solid var(--bg-border)' : 'none', marginTop: searchMaterials.length > 0 ? '4px' : 0 }}>Transactions</div>
                    {searchTxns.map(t => (
                      <div key={t.id} style={{ padding: '8px 10px', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ color: 'var(--text-main)' }}>{t.transaction_code} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>• {t.material_name}</span></span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: t.transaction_type === 'STOCK_IN' ? '#10b981' : '#ef4444' }}>{t.transaction_type === 'STOCK_IN' ? '+' : '-'}{t.quantity}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline mini stats strip */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px', position: 'relative', zIndex: 1 }}>
          {[
            { label: 'Total Items', value: totalMaterialsCount, color: '#a5b4fc' },
            { label: 'Total Units', value: totalUnits.toLocaleString(), color: '#6ee7b7' },
            { label: 'Low Stock', value: lowStockCount, color: '#fcd34d' },
            { label: 'Out of Stock', value: outOfStockCount, color: '#fca5a5' },
            { label: 'Pending', value: pendingOrdersCount, color: '#93c5fd' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontWeight: '800', color: s.color, fontSize: '14px' }}>{s.value}</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: '600' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ KPI CARDS ════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,180px), 1fr))', gap: '16px' }}>
        {canViewCost && (
          <KpiCard icon={ShoppingBag} label="Inventory Value" value={formatCurrency(totalInventoryValue)} sub="Finance"
            iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" accent="#8b5cf6" />
        )}
        <KpiCard icon={Package} label="Total Materials" value={totalMaterialsCount} sub="Catalog"
          iconBg="rgba(99,102,241,0.12)" iconColor="#6366f1" accent="#6366f1" />
        <KpiCard icon={TrendingUp} label="Stock Health" value={`${stockHealthPercent}%`} sub="Status"
          iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" accent="#10b981" />
        <KpiCard icon={AlertTriangle} label="Low Stock" value={lowStockCount} sub="Alert"
          iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" accent="#f59e0b" />
        <KpiCard icon={PackageX} label="Out of Stock" value={outOfStockCount} sub={outOfStockCount > 0 ? 'Urgent' : 'All Clear'}
          iconBg={outOfStockCount > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)'} iconColor={outOfStockCount > 0 ? '#ef4444' : '#10b981'} accent={outOfStockCount > 0 ? '#ef4444' : '#10b981'} />
        <KpiCard icon={Clock} label="Pending Requests" value={pendingOrdersCount} sub="Queue"
          iconBg="rgba(14,165,233,0.12)" iconColor="#0ea5e9" accent="#0ea5e9" />
        <KpiCard icon={Store} label="Departments" value={departmentsCount} sub="Active"
          iconBg="rgba(168,85,247,0.12)" iconColor="#a855f7" accent="#a855f7" />
      </div>

      {/* ══ MAIN BODY ═════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Monthly movement */}
            <SectionCard title="Monthly Movement" subtitle="Last 6 months — stock in vs. out">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Bar dataKey="in"  name="Stock In"  fill="#10b981" radius={[5,5,0,0]} barSize={11} />
                  <Bar dataKey="out" name="Stock Out" fill="#f43f5e" radius={[5,5,0,0]} barSize={11} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                {[['#10b981', 'Stock In'], ['#f43f5e', 'Stock Out']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: c }} />{l}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Category donut */}
            <SectionCard title="Stock by Category" subtitle="Breakdown by unit quantity">
              <div style={{ position: 'relative', height: '160px' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={46} outerRadius={66} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-main)', display: 'block' }}>{donutData.reduce((s, d) => s + d.value, 0).toLocaleString()}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Units</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', justifyContent: 'center' }}>
                {donutData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Recent Activity */}
          <SectionCard title="Recent Stock Activity" subtitle="Latest movements across all materials"
            badge={<span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '3px 10px', borderRadius: '999px', fontWeight: '700' }}>Live</span>}>
            {recentTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '13px' }}>No recent transactions recorded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {recentTransactions.map((tx, idx) => {
                  const isIn = tx.transaction_type === 'STOCK_IN';
                  const txDate = new Date(tx.transaction_date || tx.created_at || Date.now());
                  return (
                    <div key={tx.id || idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 4px',
                      borderBottom: idx < recentTransactions.length - 1 ? '1px solid var(--bg-border)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                          background: isIn ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isIn
                            ? <ArrowDownLeft size={15} color="#10b981" />
                            : <ArrowUpRight size={15} color="#f43f5e" />}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{sanitizeText(tx.material_name || tx.transaction_code, 'Transaction')}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {sanitizeText(tx.transaction_code, '—')} · {txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '13px', fontWeight: '800',
                          color: isIn ? '#10b981' : '#f43f5e',
                          background: isIn ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
                          padding: '4px 10px', borderRadius: '8px'
                        }}>
                          {isIn ? '+' : '-'}{tx.quantity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Most Issued Materials bar chart */}
          {mostIssuedMaterials.length > 0 && (
            <SectionCard title="Most Issued Materials" subtitle="All-time stock-out totals by item">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {mostIssuedMaterials.map((item, idx) => {
                  const maxQty = mostIssuedMaterials[0]?.qty || 1;
                  const pct = Math.round((item.qty / maxQty) * 100);
                  const barColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#a855f7'];
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{item.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{item.qty} issued</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '999px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'inherit', background: barColors[idx % barColors.length], transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick Actions */}
          <SectionCard title="Quick Actions"
            badge={<Zap size={16} color="#f59e0b" />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <QuickAction icon={ArrowDownLeft} label="Receive Stock" desc="Record a stock-in movement" color="#10b981" bg="rgba(16,185,129,0.05)" border="#10b981" onClick={onQuickStockIn} />
              <QuickAction icon={ArrowUpRight} label="Issue Materials" desc="Record a stock-out movement" color="#f43f5e" bg="rgba(244,63,94,0.05)" border="#f43f5e" onClick={onQuickStockOut} />
              <QuickAction icon={ClipboardList} label="New Request" desc="Submit a material request" color="#6366f1" bg="rgba(99,102,241,0.05)" border="#6366f1" onClick={onOpenRequests} />
              <QuickAction icon={MoveRight} label="Transfer Stock" desc="Move items between locations" color="#0ea5e9" bg="rgba(14,165,233,0.05)" border="#0ea5e9" onClick={onOpenTransfers} />
            </div>
          </SectionCard>

          {/* Stock Health */}
          <SectionCard title="Stock Health Overview"
            badge={<span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' }} />}>
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <span style={{ fontSize: '32px', fontWeight: '900', color: stockHealthPercent >= 70 ? '#10b981' : stockHealthPercent >= 40 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>{stockHealthPercent}%</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>of {totalMaterialsCount} items healthy</span>
              </div>
              {/* Segmented health bar */}
              <div style={{ height: '10px', borderRadius: '999px', background: 'var(--bg-secondary)', overflow: 'hidden', marginBottom: '14px' }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, stockHealthPercent))}%`, borderRadius: 'inherit', background: stockHealthPercent >= 70 ? 'linear-gradient(90deg,#10b981,#34d399)' : stockHealthPercent >= 40 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)', transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Healthy', value: totalMaterialsCount - lowStockCount - outOfStockCount, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                  { label: 'Low', value: lowStockCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                  { label: 'Empty', value: outOfStockCount, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px 6px', borderRadius: '10px', background: s.bg }}>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Stock Alerts */}
          <SectionCard title="Stock Alerts"
            badge={
              (outOfStockCount + lowStockCount) > 0
                ? <span style={{ fontSize: '11px', background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>{outOfStockCount + lowStockCount}</span>
                : <CheckCircle size={15} color="#10b981" />
            }>
            {outOfStockCount === 0 && lowStockItems.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 0', color: '#10b981' }}>
                <CheckCircle size={28} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>All stock levels are healthy</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                {/* Out of stock - urgent */}
                {outOfStockItems.slice(0, 3).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <PackageX size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeText(item.name, 'Unknown')}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', flexShrink: 0, marginLeft: '6px' }}>EMPTY</span>
                  </div>
                ))}
                {/* Low stock */}
                {lowStockItems.slice(0, 4).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '10px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeText(item.name, 'Unknown')}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Min: {item.min_stock_level} {item.unit_of_measure || 'units'}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#f59e0b', flexShrink: 0, marginLeft: '6px' }}>{sanitizeNumber(item.current_stock)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
