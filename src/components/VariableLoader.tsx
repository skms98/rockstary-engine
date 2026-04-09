'use client'

import { useState, useEffect } from 'react'

interface Preset {
  id: string
  name: string
  variables: Record<string, unknown>
}

interface Props {
  type: 'events' | 'attractions'
  variables: Record<string, unknown>
  onApply: (variables: Record<string, unknown>) => void
  onClose: () => void
}

const PRESETS_KEY = (type: string) => `batch_presets_${type}`

function loadPresets(type: string): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY(type)) || '[]')
  } catch { return [] }
}

function savePresets(type: string, presets: Preset[]) {
  localStorage.setItem(PRESETS_KEY(type), JSON.stringify(presets))
}

export default function VariableLoader({ type, variables, onApply, onClose }: Props) {
  const [saved, setSaved] = useState<Preset[]>([])
  const [local, setLocal] = useState({ ...variables })
  const [saveName, setSaveName] = useState('')
  const [tab, setTab] = useState<'edit' | 'presets'>('edit')

  useEffect(() => {
    setSaved(loadPresets(type))
    setLocal({ ...variables })
  }, [type])

  const savePreset = () => {
    if (!saveName.trim()) return alert('Enter a preset name first')
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: saveName.trim(),
      variables: { ...local }
    }
    const updated = [...loadPresets(type), newPreset]
    savePresets(type, updated)
    setSaved(updated)
    setSaveName('')
  }

  const deletePreset = (id: string) => {
    const updated = loadPresets(type).filter(p => p.id !== id)
    savePresets(type, updated)
    setSaved(updated)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0e0e1a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-white font-semibold text-base">Batch Variables</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {(['edit', 'presets'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-orange-400 border-b-2 border-orange-400 -mb-px'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'edit' ? '⚙ Configure' : '📁 Saved Presets'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'edit' ? (
            <div className="space-y-4">
              {/* Events-specific fields */}
              {type === 'events' && (
                <>
                  <Field
                    label="OpenAI Auth Token"
                    value={String(local.authToken || '')}
                    onChange={v => setLocal(l => ({ ...l, authToken: v }))}
                    inputType="password"
                    placeholder="sk-..."
                  />
                  <Field
                    label="Admin Key"
                    value={String(local.adminKey || '')}
                    onChange={v => setLocal(l => ({ ...l, adminKey: v }))}
                    inputType="password"
                    placeholder="Your admin key"
                  />
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Mode</label>
                    <div className="flex gap-2">
                      {['b2c', 'b2b'].map(m => (
                        <button
                          key={m}
                          onClick={() => setLocal(l => ({ ...l, mode: m }))}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            local.mode === m
                              ? 'bg-orange-500 text-white'
                              : 'bg-white/5 text-gray-400 hover:text-white'
                          }`}
                        >
                          {m.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Attractions-specific fields */}
              {type === 'attractions' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-2">Pipeline Steps to Run</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'seo', label: 'Generate SEO' },
                      { key: 'classify', label: 'Classify' },
                      { key: 'evaluate', label: 'Evaluate Quality' }
                    ].map(({ key, label }) => {
                      const steps = (local.steps as string[]) || []
                      const active = steps.includes(key)
                      return (
                        <button
                          key={key}
                          onClick={() => setLocal(l => ({
                            ...l,
                            steps: active
                              ? steps.filter(s => s !== key)
                              : [...steps, key]
                          }))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? 'bg-orange-500 text-white'
                              : 'bg-white/5 text-gray-400 hover:text-white'
                          }`}
                        >
                          {active ? '✓ ' : ''}{label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Select which AI steps to run on each selected attraction</p>
                </div>
              )}

              {/* Save as preset */}
              <div className="pt-3 border-t border-white/5">
                <label className="block text-xs text-gray-400 mb-2">Save as preset</label>
                <div className="flex gap-2">
                  <input
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && savePreset()}
                    placeholder="e.g. Default B2C"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
                  />
                  <button
                    onClick={savePreset}
                    disabled={!saveName.trim()}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {saved.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-6">No saved presets yet</p>
              )}
              {saved.map(preset => (
                <div key={preset.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{preset.name}</p>
                  </div>
                  <button
                    onClick={() => { setLocal({ ...preset.variables }); setTab('edit') }}
                    className="text-xs text-orange-400 hover:text-orange-300 px-2 py-1 rounded transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(local)}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, inputType = 'text', placeholder
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputType?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <input
        type={inputType}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
      />
    </div>
  )
}
