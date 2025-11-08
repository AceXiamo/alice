type View = 'wave' | 'history'

export function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const options: { key: View; label: string }[] = [
    { key: 'wave', label: '音波' },
    { key: 'history', label: '记录' },
  ]

  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur px-1 py-1 shadow-sm">
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={
              'relative px-4 py-1.5 text-sm rounded-full transition-colors ' +
              (active
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white')
            }
            aria-pressed={active}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export type { View }

