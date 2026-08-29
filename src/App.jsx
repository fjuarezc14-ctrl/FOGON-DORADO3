import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { UtensilsCrossed, LayoutDashboard, LayoutGrid, ChefHat, GlassWater, Calculator, PieChart, BookOpen, UsersRound, Menu, X, ChevronRight, LogOut, Lock, Salad, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import logoUrl from './assets/logo.jpg';
import { api } from './api';
import DashboardPage from './pages/DashboardPage';
import SalonPage from './pages/SalonPage';
import CocinaPage from './pages/CocinaPage';
import BarraPage from './pages/BarraPage';
import CajaPage from './pages/CajaPage';
import ComprasPage from './pages/ComprasPage';
import ReportesPage from './pages/ReportesPage';
import CartaPage from './pages/CartaPage';
import UsuariosPage from './pages/UsuariosPage';
import EnsaladasPage from './pages/EnsaladasPage';
import CreditosPage from './pages/CreditosPage';
import PeriodicPaymentAlert from './components/PeriodicPaymentAlert';

// === PROTECTED ROUTE NAVIGATION GUARD ===
const ProtectedRoute = ({ children, permission, currentUser }) => {
  const userPermissions = currentUser?.permisos || [];
  const isAdmin = currentUser?.rol === 'Administrador';
  if (!isAdmin && !userPermissions.includes(permission)) {
    // Redireccionar al primer módulo permitido del usuario
    const firstPermitted = userPermissions.find(p => p !== 'Usuarios') || userPermissions[0] || 'Salon';
    const pathToRedirect = 
      firstPermitted === 'Dashboard' ? '/' :
      firstPermitted === 'Salon' ? '/salon' :
      firstPermitted === 'Cocina' ? '/cocina' :
      firstPermitted === 'Barra' ? '/barra' :
      firstPermitted === 'Ensaladas' ? '/ensaladas' :
      firstPermitted === 'Caja' ? '/caja' :
      firstPermitted === 'Reportes' ? '/reportes' : '/salon';
    return <Navigate to={pathToRedirect} replace />;
  }
  return children;
};

// === LOGIN GATE (PANTALLA DE BLOQUEO PREMIUM POR PIN) ===
const LoginGate = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }
    setCargando(true);
    try {
      const res = await api.login(pin);
      if (res.error) {
        throw new Error(res.error);
      }
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Error de conexión');
      setPin('');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl flex flex-col items-center">
        {/* Branding */}
        <div className="flex flex-col items-center mb-6 md:mb-8 text-center">
          <img src={logoUrl} className="w-20 h-20 rounded-full border-2 border-amber-500/30 object-cover shadow-xl shadow-amber-500/10 mb-3 animate-pulse" alt="Fogón Dorado Logo" />
          <div>
            <h1 className="text-white font-black text-2xl tracking-tighter leading-none">FOGÓN<span className="text-amber-500">ERP</span></h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Control de Acceso</p>
          </div>
        </div>

        {/* Indicadores de PIN */}
        <div className="flex gap-4 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div 
              key={idx} 
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > idx 
                  ? 'bg-amber-500 border-amber-500 scale-110 shadow-lg shadow-amber-500/50' 
                  : 'bg-transparent border-slate-700'
              }`}
            ></div>
          ))}
        </div>

        {/* Mensaje de Error */}
        <div className="h-6 mb-4 flex items-center">
          {error && <p className="text-xs text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-lg">{error}</p>}
          {cargando && <p className="text-xs text-amber-500 font-bold animate-pulse">Validando PIN...</p>}
        </div>

        {/* Teclado Numérico */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button 
              key={num}
              onClick={() => handleKeyPress(num)}
              className="aspect-square bg-slate-800/50 hover:bg-slate-800 text-white font-black text-2xl rounded-2xl border border-slate-800/80 transition-colors active:scale-95 flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button 
            onClick={handleClear}
            className="aspect-square bg-slate-800/30 hover:bg-slate-800/50 text-slate-400 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center uppercase tracking-wider"
          >
            Clear
          </button>
          <button 
            onClick={() => handleKeyPress(0)}
            className="aspect-square bg-slate-800/50 hover:bg-slate-800 text-white font-black text-2xl rounded-2xl border border-slate-800/80 transition-colors active:scale-95 flex items-center justify-center"
          >
            0
          </button>
          <button 
            onClick={handleBackspace}
            className="aspect-square bg-slate-800/30 hover:bg-slate-800/50 text-slate-400 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center uppercase tracking-wider"
          >
            Del
          </button>
        </div>
      </div>
    </div>
  );
};

// === COMPONENTS ===
const Sidebar = ({ isOpen, toggleSidebar, currentUser, onLogout }) => {
  const location = useLocation();

  // Mapeo dinámico de permisos para visualización
  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'Dashboard' },
    { path: '/salon', icon: LayoutGrid, label: 'Salón / Mesas', permission: 'Salon' },
    { path: '/cocina', icon: ChefHat, label: 'Cocina / Pedidos', permission: 'Cocina' },
    { path: '/barra', icon: GlassWater, label: 'Barra / Bebidas', permission: 'Barra' },
    { path: '/ensaladas', icon: Salad, label: 'Ensaladas / Fríos', permission: 'Ensaladas' },
    { path: '/caja', icon: Calculator, label: 'Caja / Cobros', permission: 'Caja' },
    { path: '/creditos', icon: Wallet, label: 'Créditos / Clientes', permission: 'Caja' },
    { path: '/compras', icon: BookOpen, label: 'Compras / Gastos', permission: 'Caja' },
    { path: '/reportes', icon: PieChart, label: 'Reportes (Contador)', permission: 'Reportes' },
    { path: '/carta', icon: BookOpen, label: 'Carta e Inventario', permission: 'Dashboard' },
  ];

  // Filtrar ítems según permisos del usuario activo o si es administrador
  const userPermissions = currentUser?.permisos || [];
  const isAdmin = currentUser?.rol === 'Administrador';
  const filteredItems = menuItems.filter(item => isAdmin || userPermissions.includes(item.permission));

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden ${isOpen ? 'block' : 'hidden'}`}
        onClick={toggleSidebar}
      ></div>

      <aside className={`fixed md:relative inset-y-0 left-0 w-64 bg-slate-900 text-slate-400 flex flex-col shadow-2xl z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="p-6 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <img src={logoUrl} className="w-10 h-10 rounded-full border border-slate-700/50 object-cover shrink-0 shadow-lg shadow-amber-500/10" alt="Fogón Dorado Logo" />
            <span className="text-white font-black text-xl tracking-tighter">FOGÓN<span className="text-amber-500">ERP</span></span>
          </div>
          <button onClick={toggleSidebar} className="text-slate-400 hover:text-white md:hidden p-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 mt-4 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { if(window.innerWidth < 768) toggleSidebar(); }}
                className={`sidebar-item flex items-center gap-3 p-3 text-sm ${isActive ? 'sidebar-active' : ''}`}
              >
                <item.icon className="w-5 h-5" /> {item.label}
              </Link>
            )
          })}
          {userPermissions.includes('Usuarios') && (
            <>
              <div className="my-4 border-t border-slate-800 mx-4"></div>
              <Link to="/usuarios" onClick={() => { if(window.innerWidth < 768) toggleSidebar(); }} className="sidebar-item flex items-center gap-3 p-3 text-sm"><UsersRound className="w-5 h-5"/> Personal y Accesos</Link>
            </>
          )}
        </nav>

        {/* Footer del usuario logueado */}
        <div className="p-4 border-t border-slate-800 shrink-0 flex flex-col gap-3 bg-slate-950/20">
          <div className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-xl border border-slate-800/50">
            <div className="w-8 h-8 bg-amber-500 text-slate-900 rounded-full flex items-center justify-center text-xs font-black shrink-0">
              {currentUser?.nombre?.substring(0, 2).toUpperCase()}
            </div>
            <div className="text-xs truncate flex-1">
              <p className="text-white font-bold">{currentUser?.nombre}</p>
              <p className="text-amber-400 font-mono text-[10px] uppercase font-black">{currentUser?.rol}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full py-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
};

const Header = ({ toggleSidebar, title, currentUser }) => (
  <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
    <div className="flex items-center gap-3">
      <button onClick={toggleSidebar} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl md:hidden">
        <Menu className="w-6 h-6" />
      </button>
      <div className="hidden sm:flex items-center gap-2 text-slate-500 text-sm font-medium">
        <span>Sistema</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-bold">{title || 'Punto de Cobro'}</span>
      </div>
    </div>
    
    <div className="flex items-center gap-4">
      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider hidden md:inline">Usuario Activo: <strong className="text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">{currentUser?.nombre} ({currentUser?.rol})</strong></span>
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        Sync BD Activo
      </div>
    </div>
  </header>
);

const Layout = ({ children, title, currentUser, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 relative">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} currentUser={currentUser} onLogout={onLogout} />
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} title={title} currentUser={currentUser} />
        {children}
      </main>
    </div>
  );
};

// === APP MAIN ENTRY ===
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            // Validar directamente contra el servidor
            const status = await api.checkUserStatus(parsed.id);
            if (!status || !status.exists || !status.activo) {
              localStorage.removeItem('currentUser');
              setCurrentUser(null);
            } else if (parsed.pinSignature && status.pinSignature && parsed.pinSignature !== status.pinSignature) {
              localStorage.removeItem('currentUser');
              setCurrentUser(null);
              alert('⚠️ La contraseña/PIN de tu cuenta ha sido modificada por el administrador. Por favor, inicia sesión con tu nuevo PIN.');
            } else {
              // Sincronizar roles y permisos actualizados de la BD
              const updatedUser = {
                ...parsed,
                nombre: status.nombre || parsed.nombre,
                rol: status.rol || parsed.rol,
                permisos: status.permisos || parsed.permisos || [],
                pinSignature: status.pinSignature || parsed.pinSignature,
              };
              setCurrentUser(updatedUser);
              localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            }
          } else {
            localStorage.removeItem('currentUser');
            setCurrentUser(null);
          }
        } catch (e) {
          console.error('Error inicializando sesión:', e);
          try {
            setCurrentUser(JSON.parse(saved));
          } catch (err) {
            localStorage.removeItem('currentUser');
          }
        }
      }
      setLoading(false);
    };

    initSession();
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  // Polling de seguridad activo: detectar si el usuario fue eliminado, desactivado o si cambió su PIN/rol
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.checkUserStatus(currentUser.id);
        if (!res || !res.exists || !res.activo) {
          handleLogout();
          alert('⚠️ Tu usuario ha sido eliminado o desactivado. Sesión cerrada.');
        } else if (currentUser.pinSignature && res.pinSignature && currentUser.pinSignature !== res.pinSignature) {
          handleLogout();
          alert('⚠️ La contraseña/PIN de tu cuenta fue modificada por el administrador. Sesión cerrada.');
        } else if (res.rol !== currentUser.rol || JSON.stringify(res.permisos) !== JSON.stringify(currentUser.permisos)) {
          // Sincronizar en tiempo real los permisos modificados
          const syncedUser = {
            ...currentUser,
            nombre: res.nombre,
            rol: res.rol,
            permisos: res.permisos,
            pinSignature: res.pinSignature,
          };
          setCurrentUser(syncedUser);
          localStorage.setItem('currentUser', JSON.stringify(syncedUser));
        }
      } catch (err) {
        console.error('Error validando sesión periódica:', err);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginGate onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <PeriodicPaymentAlert currentUser={currentUser} />
      <Routes>
        <Route path="/" element={<Layout title="Resumen de Ventas" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><DashboardPage /></ProtectedRoute></Layout>} />
        <Route path="/salon" element={<Layout title="Gestión de Salón" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Salon" currentUser={currentUser}><SalonPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/cocina" element={<Layout title="Monitor de Preparación" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Cocina" currentUser={currentUser}><CocinaPage /></ProtectedRoute></Layout>} />
        <Route path="/barra" element={<Layout title="Monitor de Barra" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Barra" currentUser={currentUser}><BarraPage /></ProtectedRoute></Layout>} />
        <Route path="/ensaladas" element={<Layout title="Monitor de Ensaladas" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Ensaladas" currentUser={currentUser}><EnsaladasPage /></ProtectedRoute></Layout>} />
        <Route path="/caja" element={<Layout title="Punto de Cobro" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Caja" currentUser={currentUser}><CajaPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/creditos" element={<Layout title="Módulo de Créditos" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Caja" currentUser={currentUser}><CreditosPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/compras" element={<Layout title="Registro de Compras" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Caja" currentUser={currentUser}><ComprasPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/reportes" element={<Layout title="Panel Contable" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Reportes" currentUser={currentUser}><ReportesPage /></ProtectedRoute></Layout>} />
        <Route path="/carta" element={<Layout title="Carta e Inventario" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Dashboard" currentUser={currentUser}><CartaPage currentUser={currentUser} /></ProtectedRoute></Layout>} />
        <Route path="/usuarios" element={<Layout title="Personal y Accesos" currentUser={currentUser} onLogout={handleLogout}><ProtectedRoute permission="Usuarios" currentUser={currentUser}><UsuariosPage /></ProtectedRoute></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
