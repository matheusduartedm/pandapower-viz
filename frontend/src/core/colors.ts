/** Color constants for pandapower network visualization. */
export const COLORS = {
  // Element types
  bus: '#60a5fa',
  ext_grid: '#fbbf24',
  load: '#f87171',
  sgen: '#4ade80',
  gen: '#facc15',
  line: '#94a3b8',
  trafo: '#a78bfa',
  switch_closed: '#9ca3af',
  switch_open: '#ef4444',
  solar: '#fbbf24',
  wind: '#38bdf8',
  storage: '#22c55e',

  // Compact mode bus colors
  compact_gen_load: '#2dd4bf',
  compact_gen: '#4ade80',
  compact_load: '#fb923c',

  // Analysis result thresholds
  ok: '#4ade80',
  warn: '#fbbf24',
  fail: '#ef4444',

  // Line loading gradient (map)
  loading_low: '#22c55e',
  loading_medium: '#eab308',
  loading_high: '#f97316',
  loading_overload: '#ef4444',

  // Interactive states
  highlight: '#22d3ee',
  hover: '#38bdf8',
} satisfies Record<string, string>;
