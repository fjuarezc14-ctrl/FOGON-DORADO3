import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que la próxima renderización muestre la interfaz de repuesto
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Registra el error en la consola
    console.error("Error capturado por Error Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Interfaz de repuesto cuando se cae el sistema o falla la renderización
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4 text-center select-none">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full border-t-4 border-amber-500 flex flex-col items-center">
            <span className="text-5xl mb-4 block animate-bounce">📡</span>
            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">¡Ups! Perdimos la conexión</h1>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed font-medium">
              El sistema no pudo cargar la pantalla. Verifica que el servidor local y tu conexión estén funcionando correctamente.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 px-6 rounded-2xl w-full transition-all shadow-lg shadow-amber-500/20 active:scale-95 text-sm uppercase tracking-wide"
            >
              🔄 Recargar Sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
