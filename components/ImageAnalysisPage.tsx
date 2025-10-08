'use client'

import React, { useState, useRef } from 'react'
// No longer need FaceAnalysis - now using only BodyAnalysis

type Message = { from: 'user' | 'assistant' | 'system'; text: string }

export default function ImageAnalysisPage() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [editedUrl, setEditedUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)

  async function handleLoadLastGenerated() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/registry')
      const j = await res.json()
      if (!j.ok) {
        setMessages(m => [...m, { from: 'system', text: 'No se pudo obtener el registro.' }])
        setLoading(false)
        return
      }
      const arr: Array<{ publicId: string; url: string; createdAt: number }> = j.data || []
      if (!arr.length) {
        setMessages(m => [...m, { from: 'system', text: 'No hay imágenes generadas en el registro.' }])
        setLoading(false)
        return
      }
      const latest = arr.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
      // Load into the session as the shown image (edited preview). We set editedUrl null so it shows as a single image preview.
      setOriginalUrl(latest.url)
      setEditedUrl(null)
      setSessionId(null)
      setMessages(m => [...m, { from: 'system', text: `Cargado último generado: ${latest.publicId}` }])
  } catch (_e: unknown) {
    const msg = _e instanceof Error ? _e.message : String(_e);
    setMessages(m => [...m, { from: 'system', text: 'Error cargando último generado: ' + msg }])
  } finally {
    setLoading(false)
  }
  }

  async function handleUpload(file: File) {
    setLoading(true)
    setOriginalUrl(null)
    setEditedUrl(null)
    setMessages([])
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const j = await res.json()
    if (j.error) {
      setMessages(m => [...m, { from: 'system', text: 'Error uploading image: ' + j.error }])
      setLoading(false)
      return
    }
    // j.imageUrl is now the optimized Cloudinary URL (1024px max width)
    // This ensures consistent dimensions for both display and AI processing
    setOriginalUrl(j.imageUrl)
    setSessionId(j.sessionId)

    // analyze
    const aRes = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl: j.imageUrl, locale: 'es' }) })
    const aJson = await aRes.json()
      const suggestion = aJson.analysis?.suggestedText || 'We suggest an outfit suggestion to enhance proportions.'
    setMessages(m => [...m, { from: 'assistant', text: suggestion }])

    // first edit
    await generateEdit(suggestion, j.imageUrl, j.publicId, j.sessionId, aJson.analysis)
    setLoading(false)
  }

  async function generateEdit(userText: string, imageUrlParam?: string, prevPublicId?: string | null, sessionIdParam?: string | null, analysisParam?: unknown) {
    if (!originalUrl && !imageUrlParam) return
    setLoading(true)
    const body = { sessionId: sessionIdParam || sessionId, originalImageUrl: imageUrlParam || originalUrl, userText, prevPublicId, analysis: analysisParam }
    const res = await fetch('/api/iterate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json()
    if (j.error) {
      setMessages(m => [...m, { from: 'system', text: 'Error in editing: ' + j.error }])
      setLoading(false)
      return
    }

    // replace last assistant note and append new
    setMessages(m => {
      const copy = [...m]
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].from === 'assistant') { copy.splice(i, 1); break }
      }
      const noteText = j.note || ''
      return [...copy, { from: 'assistant', text: noteText }]
    })
    setEditedUrl(j.editedUrl)
    setLoading(false)
  }

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const userInput = chatInputRef.current?.value
    if (!userInput || !originalUrl) return

    setMessages(m => [...m, { from: 'user', text: userInput }])
    generateEdit(userInput)
    if(chatInputRef.current) {
      chatInputRef.current.value = ''
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left side: Chat Interface */}
      <div className="w-1/3 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-2xl font-bold">Asesor de Estilo</h1>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`chat ${m.from === 'user' ? 'chat-end' : 'chat-start'}`}>
              <div className={`chat-bubble ${m.from === 'user' ? 'bg-primary' : 'bg-gray-700'}`}>{m.text}</div>
            </div>
          ))}
           {loading && <div className="chat chat-start"><div className="chat-bubble bg-gray-700">Generating...</div></div>}
        </div>
        <div className="p-4 border-t border-border">
          <form onSubmit={handleChatSubmit}>
            <input
              ref={chatInputRef}
              type="text"
              placeholder={originalUrl ? "Tell me what you think..." : "Upload an image to start"}
              className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={!originalUrl || loading}
            />
          </form>
        </div>
      </div>

      {/* Right side: Image Display */}
      <div className="w-2/3 flex items-center justify-center p-8">
        {!originalUrl ? (
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">Upload Your Photo</h2>
            <p className="text-slate-400 mb-8 text-lg">Get a realistic preview of a suggested outfit and styling for your photo.</p>
            <button
              className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-[var(--color-accent-primary-hover)] transition-colors duration-300 text-xl"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Upload Image'}
            </button>
            <button
              className="ml-4 bg-gray-800 text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors duration-200 text-sm"
              onClick={handleLoadLastGenerated}
              disabled={loading}
            >
              Cargar último generado
            </button>
            <input ref={fileRef} id="file-upload" type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {editedUrl ? (
              <div className="msg-image-container">
                <img src={editedUrl} alt="Imagen editada" className="msg-image" />
              </div>
            ) : (
              <div className="text-center">
                <img src={originalUrl} alt="Original" className="max-w-md max-h-[70vh] rounded-lg shadow-2xl" />
                {loading && <p className="text-slate-400 mt-4">Generating the first edit...</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}