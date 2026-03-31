'use client'

import { useState, useEffect, useCallback } from 'react'
import { plSupabase } from '@/lib/pl-supabase'

interface Screenshot {
  id: string
  attraction_id: string
  order_number: string
  url: string
  filename: string
  created_at: string
}

function sortByOrder(a: Screenshot, b: Screenshot) {
  const parseOrder = (o: string) => {
    const parts = o.split('.')
    const main = parseInt(parts[0]) || 0
    const sub = parts[1] ? parseInt(parts[1]) || 0 : -1
    return main * 100 + (sub === -1 ? 0 : sub)
  }
  return parseOrder(a.order_number) - parseOrder(b.order_number)
}

export function ScreenshotsTab({ attractionId, attractionTitle }: { attractionId: string; attractionTitle: string }) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [orderInput, setOrderInput] = useState('1')
  const [showSubPicker, setShowSubPicker] = useState(false)
  const [selectedMain, setSelectedMain] = useState(1)
  const [error, setError] = useState('')

  const fetchScreenshots = useCallback(async () => {
    const { data } = await plSupabase
      .from('attraction_screenshots')
      .select('*')
      .eq('attraction_id', attractionId)
      .order('order_number')
    if (data) setScreenshots((data as Screenshot[]).sort(sortByOrder))
    setLoading(false)
  }, [attractionId])

  useEffect(() => { fetchScreenshots() }, [fetchScreenshots])

  const buildFilename = (file: File, order: string) => {
    const date = new Date().toISOString().split('T')[0]
    const safeName = attractionTitle.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '').substring(0, 50)
    const ext = file.name.split('.').pop() || 'png'
    return `${date}_${safeName}_${order}.${ext}`
  }

  const handleUpload = async (files: FileList) => {
    setUploading(true)
    setError('')
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const order = orderInput
        const filename = buildFilename(file, order)
        const storagePath = `attractions/${attractionId}/${filename}`

        const { error: uploadErr } = await plSupabase.storage
          .from('attraction-screenshots')
          .upload(storagePath, file, { upsert: true })

        if (uploadErr) {
          setError(`Upload failed: ${uploadErr.message}`)
          continue
        }

        const { data: urlData } = plSupabase.storage
          .from('attraction-screenshots')
          .getPublicUrl(storagePath)

        await plSupabase.from('attraction_screenshots').insert({
          attraction_id: attractionId,
          order_number: order,
          url: urlData.publicUrl,
          filename,
        })

        // Auto-increment order for next file
        const parts = order.split('.')
        if (parts.length === 2) {
          const sub = parseInt(parts[1]) || 0
          setOrderInput(`${parts[0]}.${sub + 1}`)
        } else {
          const main = parseInt(parts[0]) || 1
          setOrderInput(`${main + 1}`)
        }
      }
      await fetchScreenshots()
    } catch (err) {
      setError('Upload failed')
    }
    setUploading(false)
  }

  const deleteScreenshot = async (ss: Screenshot) => {
    const storagePath = `attractions/${attractionId}/${ss.filename}`
    await plSupabase.storage.from('attraction-screenshots').remove([storagePath])
    await plSupabase.from('attraction_screenshots').delete().eq('id', ss.id)
    await fetchScreenshots()
  }

  const updateOrder = async (id: string, newOrder: string) => {
    await plSupabase.from('attraction_screenshots').update({ order_number: newOrder }).eq('id', id)
    await fetchScreenshots()
  }

  const mainNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const subNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Upload Screenshots</h3>

        {/* Order Number Picker */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-2">Screenshot Number</label>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {mainNumbers.map(n => (
                <button
                  key={n}
                  onClick={() => {
                    setOrderInput(String(n))
                    setSelectedMain(n)
                    setShowSubPicker(false)
                  }}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    orderInput === String(n)
                      ? 'bg-blue-600 text-white'
                      : orderInput.startsWith(`${n}.`)
                        ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSubPicker(!showSubPicker)}
              className={`px-3 h-9 rounded-lg text-xs font-medium transition-all ${
                showSubPicker ? 'bg-amber-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
              }`}
              title="Add sub-number for long sections"
            >
              .x
            </button>
            <div className="ml-2 px-3 py-1.5 bg-gray-900/50 rounded-lg border border-gray-600">
              <span className="text-white font-mono text-sm">{orderInput}</span>
            </div>
          </div>

          {showSubPicker && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">{selectedMain}.</span>
              <div className="flex gap-1">
                {subNumbers.map(s => (
                  <button
                    key={s}
                    onClick={() => setOrderInput(`${selectedMain}.${s}`)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-all ${
                      orderInput === `${selectedMain}.${s}`
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* File Upload */}
        <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          uploading ? 'border-gray-600 bg-gray-800/30' : 'border-gray-600 hover:border-blue-500/50 hover:bg-blue-500/5'
        }`}>
          <div className="text-center">
            {uploading ? (
              <p className="text-gray-400 text-sm">Uploading...</p>
            ) : (
              <>
                <p className="text-gray-400 text-sm">Drop screenshot here or click to select</p>
                <p className="text-gray-500 text-xs mt-1">Will be saved as #{orderInput}</p>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={e => e.target.files && handleUpload(e.target.files)}
          />
        </label>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Screenshots Grid */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Screenshots ({screenshots.length})</h3>
        </div>

        {loading && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>}

        {!loading && screenshots.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No screenshots uploaded yet</p>
        )}

        {!loading && screenshots.length > 0 && (
          <div className="space-y-3">
            {screenshots.map((ss) => (
              <div key={ss.id} className="flex items-center gap-3 bg-gray-900/30 rounded-lg p-3 border border-gray-700/30">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-700/50">
                  <img src={ss.url} alt={ss.filename} className="w-full h-full object-cover" />
                </div>
                <div className="flex-shrink-0">
                  <input
                    value={ss.order_number}
                    onChange={e => updateOrder(ss.id, e.target.value)}
                    className="w-14 px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-white text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 text-xs truncate">{ss.filename}</p>
                  <p className="text-gray-500 text-[10px]">{new Date(ss.created_at).toLocaleDateString()}</p>
                </div>
                <a href={ss.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">View</a>
                <button onClick={() => deleteScreenshot(ss)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
