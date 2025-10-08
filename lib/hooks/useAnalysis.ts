import { useState } from 'react';
import type { BodyAnalysis } from '../types/ai';
import { uploadImage, analyzeImage, iterateEdit, ApiError } from '../api-client';

export type AnalysisState = 'idle' | 'uploading' | 'analyzing' | 'generating' | 'complete' | 'error';

export type Message = {
  id: string;
  from: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
};

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>('idle');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BodyAnalysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addMessage = (from: Message['from'], text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), from, text, timestamp: new Date() }]);
  };

  const startUpload = async (file: File) => {
    setState('uploading');
    addMessage('system', 'Subiendo imagen...');
    setError(null);

    try {
      const uploadData = await uploadImage(file);
      setOriginalUrl(uploadData.imageUrl);
      setSessionId(uploadData.sessionId);
      setPublicId(uploadData.publicId);

      setState('analyzing');
      addMessage('system', 'Analizando tu foto...');
      const analyzeData = await analyzeImage(uploadData.imageUrl, 'es');
      // Get BodyAnalysis directly (no normalization needed)
      const analysis = analyzeData.analysis as BodyAnalysis;
      setAnalysis(analysis);
      
      if (analysis.bodyOk) {
        const suggestion = analyzeData.analysis.suggestedText || 'Recomendación generada';
        addMessage('assistant', suggestion);

        setState('generating');
        addMessage('system', 'Generando edición...');
        const editData = await iterateEdit({
          sessionId: uploadData.sessionId,
          originalImageUrl: uploadData.imageUrl,
          userText: suggestion,
          prevPublicId: uploadData.publicId,
          analysis: analysis,
        });

        setEditedUrl(editData.editedUrl);
        setPublicId(editData.publicId);
        setState('complete');
      } else {
        setState('error');
        const errorMsg = analyzeData.analysis?.advisoryText || 'No se pudo analizar la imagen correctamente';
        addMessage('system', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      const apiError = err as ApiError;
      const errorMsg = apiError.message || 'Ocurrió un error inesperado';
      setState('error');
      addMessage('system', `Error: ${errorMsg}`);
      setError(errorMsg);
    }
  };

  const submitIteration = async (userText: string) => {
    if (!originalUrl || state === 'generating') return;

    addMessage('user', userText);
    setState('generating');
    setError(null);

    try {
        const payload = {
            sessionId: sessionId!,
            originalImageUrl: originalUrl!,
            userText,
            prevPublicId: publicId,
        };

        const data = await iterateEdit(payload);

        setEditedUrl(data.editedUrl);
        setPublicId(data.publicId);
        
        // Replace last assistant message with the new one
        setMessages(prev => {
            const filtered = prev.filter(m => !(m.from === 'assistant' && m.text === messages[messages.length - 1]?.text));
            return [...filtered, { id: Date.now().toString(), from: 'assistant', text: data.note || 'Edición completada', timestamp: new Date() }];
        });
        setState('complete');
    } catch (err) {
        const apiError = err as ApiError;
        const errorMsg = apiError.message || 'Error desconocido generando la edición';
        setState('error');
        addMessage('system', `Error: ${errorMsg}`);
        setError(errorMsg);
    }
  };

  return {
    state,
    originalUrl,
    editedUrl,
    analysis,
    messages,
    error,
    startUpload,
    submitIteration,
    addMessage
  };
}
