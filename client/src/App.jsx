import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminRoute from './components/layout/AdminRoute';
import RegisterPage from './pages/RegisterPage';
import PublicDashboardPage from './pages/PublicDashboardPage';
import ChatPage from './pages/ChatPage';
import ReportsPage from './pages/ReportsPage';
import VectorStorePage from './pages/VectorStorePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAssistantPage from './pages/AdminAssistantPage';
import RecommendationAnalyticsPage from './pages/RecommendationAnalyticsPage';
import FollowUpsPage from './pages/FollowUpsPage';
import AdminBrandsPage from './pages/AdminBrandsPage';
import './App.css';

const ROUTE_TITLE_MAP = {
  '/register': 'Registro',
  '/dashboard': 'Dashboard',
  '/chat': 'Conversaciones',
  '/reports': 'Reportes',
  '/vector-store': 'Vector Store',
  '/follow-ups': 'Seguimiento',
  '/admin/users': 'Usuarios',
  '/admin/assistant': 'Asistente',
  '/admin/brands': 'Marcas',
  '/admin/analytics': 'Analítica'
};

const getFormattedPageName = (pathname) => {
  if (!pathname || pathname === '/') {
    return 'Conversaciones';
  }

  const matchedEntry = Object.entries(ROUTE_TITLE_MAP).find(([route]) => pathname.startsWith(route));
  if (matchedEntry) {
    const [, pageName] = matchedEntry;
    return `${pageName.charAt(0).toUpperCase()}${pageName.slice(1)}`;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) {
    return 'Conversaciones';
  }

  const slug = segments[segments.length - 1].replace(/-/g, ' ');
  return slug
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};

const App = () => {
  const location = useLocation();

  useEffect(() => {
    const pageName = getFormattedPageName(location.pathname);
    document.title = `iAdvisors | Merkle ${pageName}`;
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/dashboard" element={<PublicDashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/vector-store" element={<VectorStorePage />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/assistant" element={<AdminAssistantPage />} />
            <Route path="/admin/brands" element={<AdminBrandsPage />} />
            <Route path="/admin/analytics" element={<RecommendationAnalyticsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
};

export default App;
