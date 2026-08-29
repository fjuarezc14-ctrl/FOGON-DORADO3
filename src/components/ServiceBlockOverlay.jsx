import React, { useEffect } from 'react';
import { AlertOctagon, Lock, PhoneCall, ShieldAlert, CreditCard } from 'lucide-react';

/**
 * Componente de Bloqueo Temporal por Servicio Pendiente (Service Payment Block)
 * - Diseñado para restringir ÚNICAMENTE la interfaz del Administrador.
 * - Desacoplado: Desactivable fácilmente cambiando SERVICE_PAYMENT_PENDING = false
 *   o removiendo la línea de renderizado en App.jsx.
 */
export const SERVICE_PAYMENT_PENDING = true; // Cambiar a false cuando el servicio sea desbloqueado/pagado

export default function ServiceBlockOverlay({ currentUser, onLogout }) {
  // Prevenir navegación por teclado (Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Únicamente bloquear si el usuario es Administrador y el flag de servicio pendiente está activo
  if (!SERVICE_PAYMENT_PENDING || currentUser?.rol !== 'Administrador') {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl w-full max-w-xl p-6 md:p-10 shadow-2xl shadow-amber-500/10 flex flex-col items-center text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Glow de fondo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icono de Alerta */}
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 shadow-inner text-amber-500 animate-pulse">
          <ShieldAlert className="w-10 h-10" />
        </div>

        {/* Título Principal */}
        <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[11px] uppercase tracking-widest rounded-full mb-3 flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> Acceso Administrativo Suspendido
        </span>

        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3">
          Regularización de Servicio Pendiente
        </h2>

        <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed mb-6 max-w-md">
          Estimado Administrador, el acceso al módulo de gestión administrativa ha sido pausado temporalmente debido a la presencia de un saldo pendiente por el servicio de software de <strong className="text-amber-400">Fogón Dorado ERP</strong>.
        </p>

        {/* Caja Informativa de Operaciones para el Personal */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wide border-b border-slate-800 pb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Operación de Restaurante Activa:
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            El personal operario (<strong>Mozos, Cajeros, Cocina y Barra</strong>) mantiene acceso 100% libre para atender clientes, comandar y emitir comprobantes normalmente.
          </p>
        </div>

        {/* Instrucciones de Contacto */}
        <div className="w-full bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-6 text-xs text-amber-200/90 flex items-start gap-3 text-left">
          <CreditCard className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-400 font-bold block mb-0.5">¿Cómo reactivar el panel de administración?</strong>
            Comuníquese con el equipo de soporte de desarrollo de software para validar el pago y habilitar de forma inmediata el acceso completo a los reportes y gestión.
          </div>
        </div>

        {/* Botón de Cierre de Sesión para cambiar de usuario */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            Cerrar Sesión de Administrador
          </button>
        )}
      </div>
    </div>
  );
}
