import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import {
  LayoutDashboard, Package, ShoppingCart, Users, UserCircle,
  BarChart3, Building2, Settings, LogOut, Menu, X, ChevronDown, ScanLine, Calculator, FileText
} from 'lucide-react';
import StockAlertBadge from './StockAlertBadge';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/productos', label: 'Productos', icon: Package },
  { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
  { path: '/cierre-caja', label: 'Cierre de Caja', icon: Calculator },
  { path: '/notas-credito', label: 'Notas Credito', icon: FileText },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/reportes', label: 'Reportes', icon: BarChart3, adminOnly: true },
  { path: '/staff', label: 'Personal', icon: UserCircle, adminOnly: true },
  { path: '/empresa', label: 'Empresa', icon: Building2, adminOnly: true },
  { path: '/perfil', label: 'Mi Perfil', icon: Settings },
];

type SidebarState = 'open' | 'collapsed' | 'closed';

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarState, setSidebarState] = useState<SidebarState>('open');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarState('closed');
      } else {
        setSidebarState(prev => prev === 'closed' ? 'open' : prev);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(prev => !prev);
    } else {
      setSidebarState(prev => prev === 'open' ? 'collapsed' : 'open');
    }
  };

  const closeMobileSidebar = () => setMobileOpen(false);

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarWidth = isMobile
    ? (mobileOpen ? 260 : 0)
    : (sidebarState === 'collapsed' ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH);

  const sidebarExpanded = isMobile ? mobileOpen : sidebarState === 'open';

  return (
    <div style={styles.wrapper}>
      {isMobile && mobileOpen && <div style={styles.overlay} onClick={closeMobileSidebar} />}

      <aside style={{
        ...styles.sidebar,
        width: sidebarWidth,
        minWidth: sidebarWidth,
        ...(isMobile && mobileOpen ? styles.sidebarMobile : {}),
      }}>
        <div style={{
          ...styles.sidebarHeader,
          justifyContent: sidebarExpanded ? 'flex-start' : 'center',
          padding: sidebarExpanded ? '16px 20px' : '16px 0',
        }}>
          <ScanLine size={28} color="hsl(var(--primary))" />
          {sidebarExpanded && <span style={styles.sidebarLogo}>Kardexis</span>}
          {sidebarExpanded && (
            <button style={styles.closeSidebar} onClick={toggleSidebar} title="Colapsar menu">
              <X size={20} />
            </button>
          )}
        </div>

        <nav style={styles.nav}>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                title={item.label}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navItemActive : {}),
                  justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                  padding: sidebarExpanded ? '10px 16px' : '10px 0',
                }}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) closeMobileSidebar();
                }}
              >
                <Icon size={20} />
                {sidebarExpanded && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div style={{
        ...styles.main,
        marginLeft: isMobile ? 0 : sidebarWidth,
      }}>
        <header style={styles.header}>
          <button style={styles.menuBtn} onClick={toggleSidebar}>
            <Menu size={22} />
          </button>

          <div style={styles.headerRight}>
            <StockAlertBadge />
            <div style={styles.userMenuWrapper}>
              <button style={styles.userBtn} onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <div style={{
                  ...styles.avatar,
                  backgroundColor: user?.profile_picture_url ? 'transparent' : `hsl(${user?.theme_color === 'Azul' ? '221 83% 53%' : user?.theme_color === 'Verde' ? '142 71% 45%' : user?.theme_color === 'Rosa' ? '348 83% 47%' : user?.theme_color === 'Morado' ? '270 70% 60%' : '221 83% 53%'})`,
                  overflow: 'hidden'
                }}>
                  {user?.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.full_name?.charAt(0) || '?'
                  )}
                </div>
                <span style={styles.userName}>{user?.full_name?.split(' ')[0]}</span>
                <ChevronDown size={16} />
              </button>

              {userMenuOpen && (
                <>
                  <div style={styles.userMenuOverlay} onClick={() => setUserMenuOpen(false)} />
                  <div style={styles.userDropdown}>
                    <div style={styles.dropdownHeader}>
                      <div style={{
                        ...styles.dropdownAvatar,
                        backgroundColor: user?.profile_picture_url ? 'transparent' : `hsl(${user?.theme_color === 'Azul' ? '221 83% 53%' : '221 83% 53%'})`,
                        overflow: 'hidden'
                      }}>
                        {user?.profile_picture_url ? (
                          <img src={user.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          user?.full_name?.charAt(0)
                        )}
                      </div>
                      <div>
                        <div style={styles.dropdownName}>{user?.full_name}</div>
                        <div style={styles.dropdownRole}>{user?.role === 'ADMIN' ? 'Administrador' : 'Empleado'}</div>
                      </div>
                    </div>
                    <div style={styles.dropdownDivider} />
                    <button style={styles.dropdownItem} onClick={() => { navigate('/perfil'); setUserMenuOpen(false); }}>
                      <Settings size={16} /> Mi Cuenta
                    </button>
                    <button style={styles.dropdownItem} onClick={() => { navigate('/empresa'); setUserMenuOpen(false); }}>
                      <Building2 size={16} /> Empresa
                    </button>
                    <div style={styles.dropdownDivider} />
                    <button style={{ ...styles.dropdownItem, color: 'hsl(var(--danger))' }} onClick={handleLogout}>
                      <LogOut size={16} /> Cerrar Sesion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main style={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'hsl(var(--bg-color))',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 40,
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    backgroundColor: 'hsl(var(--surface-color))',
    borderRight: '1px solid hsl(var(--glass-border))',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    overflow: 'hidden',
    transition: 'width 0.2s, min-width 0.2s',
  },
  sidebarMobile: {
    width: '260px !important',
    minWidth: '260px !important',
    position: 'fixed',
    zIndex: 50,
  } as React.CSSProperties,
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderBottom: '1px solid hsl(var(--glass-border))',
    minHeight: 60,
  },
  sidebarLogo: {
    fontSize: 20,
    fontWeight: 700,
    color: 'hsl(var(--text-primary))',
    flex: 1,
  },
  closeSidebar: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: 'hsl(var(--text-secondary))',
    display: 'flex',
  },
  nav: {
    flex: 1,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderRadius: 'var(--border-radius-sm)',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: 'hsl(var(--text-secondary))',
    textAlign: 'left',
    width: '100%',
    transition: 'all var(--transition-fast)',
  },
  navItemActive: {
    backgroundColor: 'hsl(var(--primary-light))',
    color: 'hsl(var(--primary))',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    transition: 'margin-left 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: 'hsl(var(--surface-color))',
    borderBottom: '1px solid hsl(var(--glass-border))',
    position: 'sticky',
    top: 0,
    zIndex: 30,
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 'var(--border-radius-sm)',
    color: 'hsl(var(--text-primary))',
    display: 'flex',
    alignItems: 'center',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  userMenuWrapper: {
    position: 'relative',
  },
  userBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: '1px solid hsl(var(--glass-border))',
    borderRadius: 'var(--border-radius-sm)',
    padding: '6px 12px',
    cursor: 'pointer',
    color: 'hsl(var(--text-primary))',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
  },
  userName: {
    fontSize: 14,
    fontWeight: 500,
  },
  userMenuOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 59,
  },
  userDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    backgroundColor: 'hsl(var(--surface-color))',
    border: '1px solid hsl(var(--glass-border))',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    minWidth: 220,
    zIndex: 60,
    padding: '8px 0',
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
  },
  dropdownAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
  },
  dropdownName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'hsl(var(--text-primary))',
  },
  dropdownRole: {
    fontSize: 12,
    color: 'hsl(var(--text-secondary))',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'hsl(var(--glass-border))',
    margin: '4px 0',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: 'hsl(var(--text-primary))',
    width: '100%',
    textAlign: 'left',
  },
  content: {
    flex: 1,
    padding: 24,
    maxWidth: 1400,
    width: '100%',
    margin: '0 auto',
  },
};
