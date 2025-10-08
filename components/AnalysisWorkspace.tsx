"use client"

import React, { useState, useRef } from 'react'
import { Button } from './ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Input } from './ui/Input'
import { AnalysisCard } from './features/AnalysisCard'
import { uploadImage, analyzeImage, iterateEdit, ApiError } from '../lib/api-client'
import type { BodyAnalysis } from '../lib/types/ai'

type Message = {
  id: string
  from: 'user' | 'assistant' | 'system'
  text: string
  timestamp: Date
}

type AnalysisState = 'idle' | 'uploading' | 'analyzing' | 'generating' | 'complete' | 'error'

export default function AnalysisWorkspace() {
  // State management
  const [state, setState] = useState<AnalysisState>('idle')
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [editedUrl, setEditedUrl] = useState<string | null>(null)
  const [publicId, setPublicId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<BodyAnalysis | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  
  const fileRef = useRef<HTMLInputElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll messages
  React.useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

// ... (imports and type definitions)

// Handle file upload
async function handleUpload(file: File) {
  setState('uploading');
  addMessage('system', 'Subiendo imagen...');

  try {
    const uploadData = await uploadImage(file);
    setOriginalUrl(uploadData.imageUrl);
    setSessionId(uploadData.sessionId);
    setPublicId(uploadData.publicId);

    // Analyze
    setState('analyzing');
    addMessage('system', 'Analizando cuerpo y prendas...');
    const analyzeData = await analyzeImage(uploadData.imageUrl, 'es');
    // Get clean BodyAnalysis (no legacy normalization needed)
    const analysis = analyzeData.analysis as BodyAnalysis;
    setAnalysis(analysis);
    
    if (analysis.bodyOk) {
      const suggestion = analyzeData.analysis.suggestedText || 'Recomendación generada';
      addMessage('assistant', suggestion);

      // Generate first edit
      setState('generating');
      addMessage('system', 'Generando edición...');
  await generateEdit(suggestion, uploadData.imageUrl, uploadData.publicId, uploadData.sessionId, analysis);
      setState('complete');
    } else {
      setState('error');
      addMessage('system', analyzeData.analysis?.advisoryText || 'No se pudo analizar la imagen correctamente');
    }
  } catch (error) {
    setState('error');
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado';
    addMessage('system', `Error: ${errorMessage}`);
  }
}

// Generate edit
async function generateEdit(
  userText: string,
  imageUrl?: string,
  prevId?: string | null,
  sessId?: string | null,
  analysisParam?: BodyAnalysis | null
) {
  try {
    const payload = {
      sessionId: sessId || sessionId,
      originalImageUrl: imageUrl || originalUrl!,
      userText,
      prevPublicId: prevId || publicId,
      analysis: analysisParam || undefined
    };

    const data = await iterateEdit(payload);

    setEditedUrl(data.editedUrl);
    setPublicId(data.publicId);
    
    // Replace last assistant message
    setMessages(prev => {
      const filtered = prev.filter(m => !(m.from === 'assistant' && m.text === messages[messages.length - 1]?.text));
      return [...filtered, {
        id: Date.now().toString(),
        from: 'assistant',
        text: data.note || 'Edición completada',
        timestamp: new Date()
      }];
    });
  } catch (error) {
    const errorMessage = (error as ApiError)?.message || 'Error desconocido generando la edición';
    addMessage('system', `Error: ${errorMessage}`);
  }
}

  // Handle chat submit
  async function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inputValue.trim() || !originalUrl || state === 'generating') return

    const userMessage = inputValue.trim()
    setInputValue('')
    addMessage('user', userMessage)

    setState('generating')
    await generateEdit(userMessage)
    setState('complete')
  }

  // Add message helper
  function addMessage(from: Message['from'], text: string) {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      from,
      text,
      timestamp: new Date()
    }])
  }

  // Download handler
  function handleDownload() {
    if (!editedUrl) return
    const a = document.createElement('a')
    a.href = editedUrl
    a.download = `perfil-pro-${Date.now()}.jpg`
    a.click()
  }

  return (
    <div className="container-app py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar - Controls & Chat */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nueva Sesión</CardTitle>
              <CardDescription>Sube una foto frontal sin filtros</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  isLoading={state === 'uploading'}
                  disabled={state === 'uploading' || state === 'analyzing'}
                >
                  {state === 'uploading' ? 'Subiendo...' : state === 'analyzing' ? 'Analizando...' : 'Subir Foto'}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {}}
                >
                  Ver ejemplo
                </Button>
                
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file)
                  }}
                />
              </div>

              {state !== 'idle' && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${
                      state === 'complete' ? 'bg-emerald-500' :
                      state === 'error' ? 'bg-red-500' :
                      'bg-yellow-500 animate-pulse'
                    }`} />
                    <span className="text-[var(--color-text-secondary)]">
                      {state === 'uploading' && 'Subiendo imagen...'}
                        {state === 'analyzing' && 'Analizando cuerpo y prendas...'}
                      {state === 'generating' && 'Generando edición...'}
                      {state === 'complete' && 'Listo'}
                      {state === 'error' && 'Error'}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Card */}
          {analysis && <AnalysisCard analysis={analysis} />}

          {/* Messages */}
          {messages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conversación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`message-bubble ${
                        msg.from === 'user' ? 'message-user' :
                        msg.from === 'assistant' ? 'message-assistant' :
                        'message-system'
                      } animate-fade-in`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                {editedUrl && state === 'complete' && (
                  <form onSubmit={handleChatSubmit} className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <div className="flex gap-2">
                      <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Describe cambios adicionales..."
                        className="flex-1"
                      />
                      <Button type="submit" variant="primary" disabled={!inputValue.trim()}>
                        Enviar
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Main Content - Image Display */}
        <main className="lg:col-span-8">
          <Card padding="lg">
            {!originalUrl ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-[var(--color-accent-primary)]/5 flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-[var(--color-accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-2">Sube tu foto para comenzar</h2>
                <p className="text-[var(--color-text-secondary)] max-w-md mb-8">
                  Obtén recomendaciones profesionales sobre prendas y combinaciones. La imagen se eliminará automáticamente en 24 horas.
                </p>
                <Button variant="primary" size="lg" onClick={() => fileRef.current?.click()}>
                  Subir Foto
                </Button>
              </div>
            ) : (
              /* Result Display */
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Resultado</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Comparación antes / después
                    </p>
                  </div>
                  
                  {editedUrl && (
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={handleDownload}>
                        Descargar
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={async () => {
                          if (!originalUrl) return
                          setState('generating')
                          const last = messages.filter(m => m.from === 'assistant').pop()
                          await generateEdit(last?.text || 'Regenerar')
                          setState('complete')
                        }}
                        isLoading={state === 'generating'}
                      >
                        Regenerar
                      </Button>
                    </div>
                  )}
                </div>

                {editedUrl ? (
                  <div className="msg-image-container">
                    <img src={editedUrl} alt="Imagen editada" className="msg-image" />
                  </div>
                ) : (
                  /* Loading State */
                  <div className="relative w-full h-[70vh] min-h-[500px] rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
                    <div className="text-center">
                      <div className="spinner mb-4 w-12 h-12 border-4" />
                      <p className="text-[var(--color-text-secondary)]">
                        {state === 'analyzing' ? 'Analizando tu foto...' : 'Generando edición...'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  )
}
