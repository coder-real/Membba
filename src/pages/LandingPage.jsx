import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const features = [
  {
    title: 'Automated Access Control',
    desc: 'Members automatically join your Telegram group after payment. Removed instantly when subscription expires.',
  },
  {
    title: 'Paystack Integration',
    desc: 'Accept payments from any Nigerian bank card or account. Webhooks handle everything in real time.',
  },
  {
    title: 'Subscription Management',
    desc: 'Track active, expired, and pending subscriptions from one dashboard. No spreadsheets needed.',
  },
  {
    title: 'Instant Payment Links',
    desc: 'Share a simple link — membba.com/join/your-community — and members pay and join instantly.',
  },
]

export default function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <span className="text-xl font-bold">Membba</span>
        <div className="flex items-center gap-4">
          {user ? (
            <Link
              to="/dashboard"
              className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-700 hover:underline">
                Login
              </Link>
              <Link
                to="/register"
                className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center px-6 py-24">
        <h1 className="text-5xl font-extrabold text-black leading-tight mb-6">
          Monetize Your Telegram Community — Automatically
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Membba handles payments, access control, and subscription management for your paid Telegram groups. No more manual verification. No more chasing payments.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/register"
            className="bg-black text-white px-6 py-3 rounded font-semibold hover:bg-gray-800"
          >
            Start for Free
          </Link>
          <Link
            to="/login"
            className="border border-gray-300 px-6 py-3 rounded font-semibold text-gray-700 hover:bg-gray-50"
          >
            Login
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { step: '1', title: 'Create a Community', desc: 'Set your price, billing cycle, and connect your Telegram group.' },
              { step: '2', title: 'Share Your Link', desc: 'Send membba.com/join/your-community to your audience.' },
              { step: '3', title: 'Get Paid Automatically', desc: 'Members pay, join instantly, and lose access when they stop paying.' },
            ].map(item => (
              <div key={item.step} className="bg-white border border-gray-200 rounded p-6">
                <div className="text-3xl font-extrabold text-black mb-3">{item.step}</div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="border border-gray-200 rounded p-6">
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-black text-white py-16 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to automate your community?</h2>
        <p className="text-gray-400 mb-8">Join creators already using Membba to monetize their Telegram groups.</p>
        <Link
          to="/register"
          className="bg-white text-black px-8 py-3 rounded font-semibold hover:bg-gray-100"
        >
          Create Your Community
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 px-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Membba. All rights reserved.
      </footer>
    </div>
  )
}
