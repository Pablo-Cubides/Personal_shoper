"use client"

import React from 'react'
import { Button } from '../ui/Button'

export function Header() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] backdrop-blur-glass border-b border-[var(--color-border)]">
      <div className="container-app">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-primary-hover)] shadow-lg">
              <span className="text-white font-bold text-lg">PP</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">Perfil Pro</h1>
              <p className="text-xs text-[var(--color-text-tertiary)] leading-none mt-0.5">
                Asesoría de prendas, paletas y fit para tu cuerpo
              </p>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm">Cómo funciona</Button>
            <Button variant="ghost" size="sm">Planes</Button>
            <Button variant="ghost" size="sm">Soporte</Button>
          </nav>
          
          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              Iniciar sesión
            </Button>
            <Button variant="primary" size="sm">
              Comenzar
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
