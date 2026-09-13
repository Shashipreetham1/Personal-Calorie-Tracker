import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import { AppLayout } from './components/AppLayout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import TodayPage from './pages/TodayPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import ImportPage from './pages/ImportPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/today" element={<TodayPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/import" element={<ImportPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
