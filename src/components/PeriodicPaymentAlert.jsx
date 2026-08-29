import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, ShieldAlert, CreditCard, Lock } from 'lucide-react';

/**
 * Componente de Alerta Recurrente por Servicio Pendiente (Periodic Payment Alert)
 * - Muestra un aviso flotante de pantalla completa a TODOS los usuarios.
 * - Frecuencia: Aparece cada 5 minutos (300 segundos).
 * - Duración: Permanece visible 10 segundos con contador regresivo en vivo y se cierra automáticamente.
 * - Desactivación rápida: Cambiar SERVICE_PAYMENT_PENDING = false cuando se renueve el servicio.
 */
export const SERVICE_PAYMENT_PENDING = true; // Cambiar a false al renovar el servicio

const WAIT_INTERVAL_SECONDS = 1 * 60; // 1 minuto (60s)
const DISPLAY_DURATION_SECONDS = 15;   // 15 segundos en pantalla

export default function PeriodicPaymentAlert({ currentUser }) {
  const [timeToNextAlert, setTimeToNextAlert] = useState(WAIT_INTERVAL_SECONDS);
  const [countdownRemaining, setCountdownRemaining] = useState(DISPLAY_DURATION_SECONDS);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  // Temporizador principal (Cuenta regresiva de 5 min para mostrar alerta)
  useEffect(() => {
    if (!SERVICE_PAYMENT_PENDING || !currentUser) return;

    if (isAlertOpen) return; // Si la alerta está abierta, no decrementar la espera

    const timer = setInterval(() => {
      setTimeToNextAlert((prev) => {
        if (prev <= 1) {
          setIsAlertOpen(true);
          setCountdownRemaining(DISPLAY_DURATION_SECONDS);
          return WAIT_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAlertOpen, SERVICE_PAYMENT_PENDING, currentUser]);

  // Temporizador de exhibición (Cuenta regresiva de 15 seg mientras la alerta está visible)
  useEffect(() => {
    if (!SERVICE_PAYMENT_PENDING || !isAlertOpen) return;

    const displayTimer = setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev <= 1) {
          setIsAlertOpen(false);
          setTimeToNextAlert(WAIT_INTERVAL_SECONDS);
          return DISPLAY_DURATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(displayTimer);
  }, [isAlertOpen, SERVICE_PAYMENT_PENDING]);

  // Prevenir que la tecla Esc cierre la ventana de alerta manualmente sin contar
  useEffect(() => {
    if (!isAlertOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isAlertOpen]);

  // Si el servicio no está pendiente o no hay sesión activa o el modal está cerrado, no renderizar nada
  if (!SERVICE_PAYMENT_PENDING || !currentUser || !isAlertOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-4 select-none animate-in fade-in duration-300"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-900 border-4 border-amber-500/60 rounded-3xl w-full max-w-xl p-6 md:p-8 shadow-2xl shadow-amber-500/30 flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Glow de fondo animado */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-amber-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-red-500/25 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* Encabezado destacado */}
        <h1 className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight uppercase mb-3 animate-pulse drop-shadow-md flex items-center gap-2">
          ⚠️ COMUNICADO IMPORTANTE DE SERVICIO ⚠️
        </h1>

        {/* Badge de Alerta */}
        <span className="px-4 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-extrabold text-xs uppercase tracking-widest rounded-full mb-3 flex items-center gap-2 shadow-sm">
          <ShieldAlert className="w-4 h-4 text-amber-400" /> AVISO DE SERVICIO DE SOFTWARE
        </span>

        {/* Título Principal */}
        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mb-3">
          Regularización de Pago Pendiente
        </h2>

        {/* Mensaje de Alta Legibilidad */}
        <p className="text-slate-200 text-sm md:text-base font-bold leading-snug mb-5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-amber-100">
          Se recuerda a todo el equipo de <span className="text-amber-400 font-black">Fogón Dorado</span> que el sistema ERP mantiene un saldo pendiente de cancelación.
        </p>

        {/* Contador Regresivo Gigante y Destacado */}
        <div className="w-full bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-3 md:p-4 mb-4 flex flex-col items-center justify-center">
          <div className="text-xs text-amber-300 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" /> Cierre automático de aviso en:
          </div>
          <div className="text-5xl md:text-6xl font-black font-mono text-white tracking-tighter drop-shadow-lg">
            00:{countdownRemaining < 10 ? `0${countdownRemaining}` : countdownRemaining}
          </div>
        </div>

        {/* Nota Institucional */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-semibold flex items-center justify-center gap-2 text-center">
          <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Favor de notificar a administración para coordinar la regularización con soporte técnico.</span>
        </div>
      </div>
    </div>
  );
}
