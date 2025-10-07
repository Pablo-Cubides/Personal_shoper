"use client"

import React, { useEffect, useState } from 'react'

type Item = { publicId: string; url: string; createdAt: number }

export default function RegistryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  async function fetchList() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/registry')
      const j = await r.json()
      if (j.ok) setItems(j.data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchList() }, [])

  async function remove(id: string) {
    await fetch('/api/admin/registry', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicId: id }) })
    fetchList()
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Generated Images Registry</h1>
      {loading && <p>Loading...</p>}
      <div className="grid grid-cols-1 gap-4">
        {items.map(it => (
          <div key={it.publicId} className="p-4 border rounded-lg flex items-center gap-4">
              <img src={it.url} alt={it.publicId} className="w-28 h-28 object-cover rounded" />
            <div className="flex-1">
              <div className="font-medium">{it.publicId}</div>
              <div className="text-sm text-muted">{new Date(it.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={() => remove(it.publicId)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
