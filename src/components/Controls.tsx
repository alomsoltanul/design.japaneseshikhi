import type { ControlProps } from '@/types'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function StringInput<T extends Record<string, unknown>>({
  data, field, onChange
}: {
  data: T
  field: keyof T
  onChange: (d: T) => void
}) {
  return (
    <input
      value={String(data[field] ?? '')}
      onChange={e => onChange({ ...data, [field]: e.target.value })}
    />
  )
}

export function Slider<T extends Record<string, unknown>>({
  label, data, field, min = 12, max = 200, onChange
}: {
  label: string
  data: T
  field: keyof T
  min?: number
  max?: number
  onChange: (d: T) => void
}) {
  const val = Number(data[field] ?? Math.round((min + max) / 2))
  return (
    <div className="slider-row">
      <label>{label}</label>
      <input type="range" min={min} max={max} value={val}
        onChange={e => onChange({ ...data, [field]: +e.target.value })} />
      <span className="slider-val">{val}px</span>
    </div>
  )
}

export function LevelSelect({ data, onChange }: ControlProps) {
  const level = String(data.level || 'N5')
  return (
    <Field label="Level">
      <select value={level}
        onChange={e => onChange({ ...data, level: e.target.value })}>
        {['N5', 'N4', 'N3', 'N2', 'N1'].map(l => <option key={l} value={l}>{l}</option>)}
      </select>
    </Field>
  )
}
