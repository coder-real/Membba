import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import CommunitiesPage from './pages/CommunitiesPage'
import CommunityFormPage from './pages/CommunityFormPage'
import MembersPage from './pages/MembersPage'
import PaymentsPage from './pages/PaymentsPage'
import SettingsPage from './pages/SettingsPage'
import AutomationsPage from './pages/AutomationsPage'
import AutomationDetailPage from './pages/AutomationDetailPage'
import AIInboxPage from './pages/AIInboxPage'
import OpsLayout from './components/OpsLayout'
import OpsOverviewPage from './pages/OpsOverviewPage'
import OpsCasesPage from './pages/OpsCasesPage'
import OpsCaseDetailPage from './pages/OpsCaseDetailPage'
import OpsHelpdeskPage from './pages/OpsHelpdeskPage'
import OpsCreatorDetailPage from './pages/OpsCreatorDetailPage'
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
              success: { iconTheme: { primary: '#c8f135', secondary: '#0a0a0a' } },
              error: { iconTheme: { primary: '#f87171', secondary: '#0a0a0a' } },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/join/:slug" element={<JoinPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/ops/helpdesk" element={<Navigate to="/membba-staff/helpdesk" replace />} />
            <Route path="/ops/creators/:id" element={<Navigate to="/membba-staff/helpdesk" replace />} />

            {/* Protected — Membba Staff Operations */}
            <Route path="/membba-staff" element={<ProtectedRoute><OpsLayout /></ProtectedRoute>}>
              <Route index element={<OpsOverviewPage />} />
              <Route path="cases" element={<OpsCasesPage />} />
              <Route path="cases/:id" element={<OpsCaseDetailPage />} />
              <Route path="helpdesk" element={<OpsHelpdeskPage />} />
              <Route path="creators/:id" element={<OpsCreatorDetailPage />} />
            </Route>

            {/* Protected — Creator Dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="communities" element={<CommunitiesPage />} />
              <Route path="communities/new" element={<CommunityFormPage />} />
              <Route path="communities/:id/edit" element={<CommunityFormPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="automations" element={<AutomationsPage />} />
              <Route path="automations/:key" element={<AutomationDetailPage />} />
              <Route path="ai-inbox" element={<AIInboxPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

