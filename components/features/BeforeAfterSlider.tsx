"use client";
import React, { useState, useEffect } from "react";

interface BeforeAfterSliderProps {
  edited: string | null;
  className?: string;
  onRetry?: () => void;
}

export function BeforeAfterSlider({ edited, className = "", onRetry }: BeforeAfterSliderProps) {
  const [editedLoaded, setEditedLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setEditedLoaded(false);
    setLoadError(null);
  }, [edited]);

  if (!edited) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {!editedLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10 rounded-lg">
          <div className="animate-pulse px-4 py-2 rounded-md bg-white/90 text-sm text-gray-700">
            Cargando imagen editada...
          </div>
        </div>
      )}
      
      <div className="msg-image-container">
        <img
          src={edited}
          alt="Imagen editada"
          className="msg-image"
          draggable={false}
          onLoad={() => setEditedLoaded(true)}
          onError={() => {
            setEditedLoaded(false);
            setLoadError('failed_to_load_edited');
          }}
          style={{ display: editedLoaded ? 'block' : 'none' }}
        />
      </div>
      
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center p-4">
            <div className="text-red-600 text-sm mb-2">Error al cargar la imagen</div>
            <button
              onClick={() => {
                setLoadError(null);
                setEditedLoaded(false);
                if (onRetry) {
                  onRetry();
                }
              }}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
