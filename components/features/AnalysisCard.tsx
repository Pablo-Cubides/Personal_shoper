"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import type { FaceAnalysis } from '../../lib/types/ai'

interface AnalysisCardProps {
  analysis: FaceAnalysis | null
  className?: string
}

export function AnalysisCard({ analysis, className = '' }: AnalysisCardProps) {
  if (!analysis) return null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Análisis Profesional</CardTitle>
        <CardDescription>Recomendaciones personalizadas basadas en IA</CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Advisory Text */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--color-accent-primary)]/5 to-[var(--color-accent-primary)]/10 border border-[var(--color-accent-primary)]/20 mb-4">
          <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
            {analysis.advisoryText || analysis.suggestedText || 'Analizando...'}
          </p>
        </div>

        {/* Analysis Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Corte</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
              {analysis.hair?.length || '—'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Barba</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
              {analysis.beard?.style || (analysis.beard?.present ? 'Presente' : 'No detectada')}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Color</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
              {analysis.hair?.color || '—'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Iluminación</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
              {analysis.lighting || '—'}
            </div>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant={analysis.faceOk ? 'success' : 'danger'}>
            {analysis.faceOk ? 'Análisis completo' : 'Requiere revisión'}
          </Badge>
          <Badge variant="secondary">
            {analysis.pose || 'Desconocido'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
