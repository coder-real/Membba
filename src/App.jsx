import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CommunitiesPage from './pages/CommunitiesPage'
import CommunityFormPage from './pages/CommunityFormPage'
import MembersPage from './pages/MembersPage'
import PaymentsPage from './pages/PaymentsPage'
import SettingsPage from './pages/SettingsPage'
import AutomationsPage from './pages/AutomationsPage'
import JoinPage from './pages/JoinPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                fontSize: '13px',
                padding: '10px 14px',
              },
              success: { iconTheme: { primary: '#9FFF57', secondary: '#0a0a0a' } },
              error: { iconTheme: { primary: '#f87171', secondary: '#0a0a0a' } },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/join/:slug" element={<JoinPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />

            {/* Protected — Creator Dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="communities" element={<CommunitiesPage />} />
              <Route path="communities/new" element={<CommunityFormPage />} />
              <Route path="communities/:id/edit" element={<CommunityFormPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="automations" element={<AutomationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

