import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CommunitiesPage from './pages/CommunitiesPage'
import CommunityFormPage from './pages/CommunityFormPage'
import MembersPage from './pages/MembersPage'
import PaymentsPage from './pages/PaymentsPage'
import SettingsPage from './pages/SettingsPage'
import JoinPage from './pages/JoinPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'

export default function App() {
  return (
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
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/dashboard/communities" element={<ProtectedRoute><CommunitiesPage /></ProtectedRoute>} />
          <Route path="/dashboard/communities/new" element={<ProtectedRoute><CommunityFormPage /></ProtectedRoute>} />
          <Route path="/dashboard/communities/:id/edit" element={<ProtectedRoute><CommunityFormPage /></ProtectedRoute>} />
          <Route path="/dashboard/members" element={<ProtectedRoute><MembersPage /></ProtectedRoute>} />
          <Route path="/dashboard/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
