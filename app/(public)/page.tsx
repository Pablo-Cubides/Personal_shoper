"use client";
import { useRef, useState } from "react";
import type { IteratePayload } from '../../lib/types/ai'



type Message = { from: "user" | "assistant" | "system"; text: string; image?: string; action?: { type: string; payload?: IteratePayload | undefined } };

export default function Page() {
  const [step, setStep] = useState<"upload" | "ready">("upload");
  const [prompt, setPrompt] = useState("");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const suggestions = [
    "Crear un estilo de barba que alargue mi rostro",
    "Sugerir peinados de bajo mantenimiento para cabello ondulado",
    "¿Qué productos necesito para una barba saludable y bien cuidada?",
  ];

  // Helper: perform /api/iterate with retries for transient 503 errors
  async function performIterateWithRetries(payload: IteratePayload, maxAttempts = 3, baseDelay = 300) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const res = await fetch('/api/iterate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.status === 503) {
          // transient - retry
          if (attempt >= maxAttempts) return { success: false, status: 503 };
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        const data = await res.json();
        if (res.ok) return { success: true, data, status: res.status };
        return { success: false, error: data.error || data.message || 'unknown', status: res.status };
      } catch (err: unknown) {
        // network or other error - retry
        if (attempt >= maxAttempts) {
          const msg = err && typeof err === 'object' && 'message' in err ? String((err as Record<string, unknown>).message) : String(err)
          return { success: false, error: msg };
        }
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return { success: false, error: 'max_attempts_reached' };
  }

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  function handleSuggestionClick(text: string) {
    if (step !== "ready") return;
    setPrompt(text);
    handleGenerate(text);
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processUpload(file);
  }

  async function processUpload(file: File) {
    setLoading(true);
    // Keep user on the main chat UI and append a system message for analysis
    setMessages((m) => [...m, { from: "system", text: "Analizando tu foto... esto puede tardar unos segundos." }]);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();

      if (uploadData.error) {
        setMessages([{ from: "system", text: `Error: ${uploadData.error}` }]);
        setStep("upload");
        setLoading(false);
        return;
      }

      // uploadData.imageUrl is now the optimized Cloudinary URL (1024px max width)
      // This ensures consistent dimensions for both display and AI processing
      setOriginalUrl(uploadData.imageUrl);
      setSessionId(uploadData.sessionId);
      setPublicId(uploadData.publicId);

      // add uploaded image into the chat as a user message so it's always visible
  setMessages((m) => [...m, { from: "user", text: "Imagen subida", image: uploadData.imageUrl }]);
  // switch to chat/ready view so the analysis message is visible in the conversation
  setStep("ready");

      // Hacer analyze primero para obtener el advisory
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadData.imageUrl, locale: "es" }),
      });
      const analyzeData = await analyzeRes.json();

      if (analyzeData.error || !analyzeData.analysis?.faceOk) {
        setMessages((m) => [...m, { from: "system", text: analyzeData.analysis?.advisoryText || "No se pudo analizar la imagen correctamente." }]);
        setStep("upload");
        setLoading(false);
        return;
      }

  const advisory = analyzeData.analysis.advisoryText || "";

      // Pequeño delay para evitar problemas de concurrencia con analyze
      await new Promise(resolve => setTimeout(resolve, 100));

      // Hacer iterate para generar la imagen con reintentos ante 503 transitorios
      const iteratePayload2 = {
        sessionId: uploadData.sessionId,
        originalImageUrl: uploadData.imageUrl,
        userText: analyzeData.analysis.suggestedText || advisory,
        prevPublicId: uploadData.publicId,
        analysis: analyzeData.analysis,
      };

      // Hacer iterate para generar la imagen (petición única con pequeño delay
      // para mitigar condiciones de carrera en el servicio externo)
      const iteratePayload = {
        sessionId: uploadData.sessionId,
        originalImageUrl: uploadData.imageUrl,
        userText: analyzeData.analysis.suggestedText || advisory,
        prevPublicId: uploadData.publicId,
        analysis: analyzeData.analysis,
      };

      await new Promise((r) => setTimeout(r, 500));
      const iterateRes = await fetch('/api/iterate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(iteratePayload2),
      });

      if (iterateRes.status === 503) {
        // Mostrar solo el análisis si no hay servicio de imágenes
        setMessages((m) => [...m, { from: 'assistant', text: advisory }]);
        setMessages((m) => [...m, {
          from: 'system',
          text: 'El servicio de edición de imágenes no está disponible por ahora.',
          action: {
            type: 'retry-iterate',
            payload: iteratePayload,
          }
        }]);
        setLoading(false);
        return;
      }

      const iterateData = await iterateRes.json();

      if (iterateData.error) {
        // Mostrar solo el análisis si hay error en la imagen
        setMessages((m) => [...m, { from: 'assistant', text: advisory }]);
        setMessages((m) => [...m, { from: 'system', text: `Error en edición: ${iterateData.error}` }]);
        setLoading(false);
        return;
      }

      setEditedUrl(iterateData.editedUrl);
      setPublicId(iterateData.publicId);

      // Agregar UN solo mensaje con el análisis completo (la imagen editada
      // se muestra a continuación en el BeforeAfterSlider usando el estado
      // `editedUrl` para evitar mostrar la misma imagen dos veces)
      setMessages((m) => [...m, { from: 'assistant', text: advisory }]);
      scrollToBottom();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as Record<string, unknown>).message) : String(err)
      setMessages((m) => [...m, { from: "system", text: `Error: ${msg}` }]);
      setStep("upload");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(text?: string) {
    const userText = text || prompt;
    if (!userText || !originalUrl || step !== "ready") return;

    setLoading(true);
    setMessages((m) => [...m, { from: "user", text: userText }]);
    setPrompt("");
    scrollToBottom();

    try {
      // usar helper con reintentos
      const payload = { sessionId, originalImageUrl: originalUrl, userText, prevPublicId: publicId };
      const result = await performIterateWithRetries(payload);
      if (!result.success) {
        if (result.status === 503) {
          setMessages((m) => [...m, {
            from: "system",
            text: "El servicio de edición de imágenes no está disponible por ahora.",
            action: {
              type: "retry-iterate",
              payload,
            }
          }]);
          setLoading(false);
          return;
        }
        setMessages((m) => [...m, { from: "system", text: `Error: ${result.error || 'unknown'}` }]);
        setLoading(false);
        return;
      }

      const iterateData2 = result.data;
      setEditedUrl(iterateData2.editedUrl);
      setPublicId(iterateData2.publicId);
      setMessages((m) => [...m, { from: "assistant", text: iterateData2.note || "Edición completada" }]);
      scrollToBottom();
    } catch (err) {
      setMessages((m) => [...m, { from: "system", text: `Error: ${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function retryIterate(payload: IteratePayload | undefined) {
    if (!payload) return;
    setLoading(true);
    // show a small system message indicating retry started
    setMessages((m) => [...m, { from: "system", text: "Reintentando la edición..." }]);

    try {
      const res = await fetch("/api/iterate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 503) {
        setMessages((m) => [...m, { from: "system", text: "El servicio de edición sigue sin estar disponible. Intenta más tarde." }]);
        return;
      }

      const data = await res.json();
      if (data.error) {
        setMessages((m) => [...m, { from: "system", text: `Error en edición: ${data.error}` }]);
        return;
      }

      setEditedUrl(data.editedUrl);
      setPublicId(data.publicId);
      setMessages((m) => [...m, { from: "assistant", text: data.note || "Edición completada" }]);
      scrollToBottom();
    } catch (err) {
      setMessages((m) => [...m, { from: "system", text: `Error al reintentar: ${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) await processUpload(file);
  }

  if (step === "upload") {
    return (
      <div className="app-center">
        <div className="chat-shell">
          <div className="chat-header">
            <h1 className="chat-title">Tu Asesor de Estilo Personal</h1>
            <p className="chat-sub">Recibe consejos sobre cortes de barba, peinados y más.</p>
          </div>

          <div className="p-6">
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-8 rounded-lg text-center ${isDragging ? "border-primary bg-primary/5" : ""}`}
            >
              <h2 className="mb-2 text-lg font-semibold">Sube tu foto para una asesoría</h2>
              <p className="mb-4 text-sm text-muted-foreground">Recomendamos que sea una foto de frente con buena iluminación.</p>
              <div className="flex items-center justify-center gap-4">
                <button onClick={handleUploadClick} disabled={loading} className="btn-accent">{loading ? "Procesando..." : "Seleccionar Imagen"}</button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium">Prueba estas ideas</h3>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s} className="suggestion">{s}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // analysis runs inline as a system message inside the chat; no separate analyzing page

  // Ready/chat view
  return (
    <div className="app-center">
      <div className="chat-shell">
        <div className="chat-header">
          <h1 className="chat-title">Tu Asesor de Estilo Personal</h1>
          <p className="chat-sub">Recibe consejos sobre cortes de barba, peinados y más.</p>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="py-12 text-center text-gray-400">Sube una imagen para comenzar la asesoría.</div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`bubble ${m.from === "user" ? "user" : m.from === "assistant" ? "assistant" : "system"}`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.image && (
                    <div className="msg-image-container">
                    <img src={m.image} alt="uploaded" className="msg-image" />
                  </div>
                )}
                {m.action?.type === 'retry-iterate' && (
                  <div className="mt-2">
                    {(() => {
                      const payload = m.action?.payload;
                      return (
                        <button onClick={() => payload && retryIterate(payload)} disabled={loading} className="btn-ghost">{loading ? 'Procesando...' : 'Reintentar'}</button>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}

          {editedUrl && (
            <div className="flex justify-start">
              <div className="bubble assistant">
                <p className="whitespace-pre-wrap">¡Aquí está tu imagen editada! 🎨</p>
                <div className="msg-image-container">
                  <img src={editedUrl} alt="Imagen editada" className="msg-image" />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="input-bar">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={originalUrl ? "Describe los cambios que quieres..." : "Sube una imagen primero"} className="input-textarea" />
          <div className="flex items-center gap-3">
            <button onClick={handleUploadClick} className="p-2">📤</button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={() => handleGenerate()} disabled={!originalUrl || loading || !prompt.trim()} className="btn-accent">{loading ? "Procesando..." : "Generar Cambios"}</button>
          </div>
        </div>

        <div className="suggestions">
          {suggestions.map((s) => (
            <button key={s} onClick={() => handleSuggestionClick(s)} disabled={loading} className={`suggestion ${(!originalUrl || loading) ? 'disabled' : ''}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
