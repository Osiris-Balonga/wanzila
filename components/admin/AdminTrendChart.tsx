'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { TrendPoint } from '@/lib/admin-analytics'

const SERIES = [
  { key: 'searches', label: 'Recherches', color: '#6639e7' },
  { key: 'views', label: 'Fiches consultées', color: '#3787ed' },
  { key: 'routes', label: 'Itinéraires', color: '#13ad78' },
] as const

function ChartTooltip({ active, label, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  return (
    <div className="admin-chart-tooltip">
      <strong>{label}</strong>
      {payload.map(item => (
        <span key={String(item.dataKey)}>
          <i style={{ background: item.color }} />
          {item.name}
          <b>{Number(item.value ?? 0).toLocaleString('fr-FR')}</b>
        </span>
      ))}
    </div>
  )
}

export function AdminTrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <div className="admin-chart">
      <div className="admin-chart__legend" aria-label="Légende du graphique">
        {SERIES.map(series => <span key={series.key}><i style={{ background: series.color }} />{series.label}</span>)}
      </div>
      <div className="admin-chart__plot">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: -17 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#e8eaf2" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#65708b', fontSize: 10 }} dy={9} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#65708b', fontSize: 10 }} width={42} />
            <Tooltip content={ChartTooltip} cursor={{ stroke: '#9199ad', strokeWidth: 1, strokeDasharray: '4 4' }} />
            {SERIES.map(series => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: series.color, stroke: '#fff', strokeWidth: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
