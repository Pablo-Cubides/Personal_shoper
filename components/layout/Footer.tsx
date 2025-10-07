"use client"

import React from 'react'

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-auto">
      <div className="container-app py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-primary-hover)]">
                <span className="text-white font-bold text-sm">PP</span>
              </div>
              <span className="text-base font-semibold">Perfil Pro</span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-xs">
              Recomendaciones profesionales de barba y cabello con inteligencia artificial. 
              Perfil que destaca sin exagerar.
            </p>
          </div>
          
          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Producto</h3>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Características</a></li>
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Cómo funciona</a></li>
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Planes</a></li>
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">API</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold mb-3">Soporte</h3>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Ayuda</a></li>
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Términos</a></li>
              <li><a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Contacto</a></li>
            </ul>
          </div>
        </div>
        
        <div className="divider my-8"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[var(--color-text-tertiary)]">
          <p>&copy; 2025 Perfil Pro. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Twitter</a>
            <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Instagram</a>
            <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
