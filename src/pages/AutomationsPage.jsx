import DashboardLayout from '../components/DashboardLayout'

export default function AutomationsPage() {
  return (
    <DashboardLayout pageTitle="Automations">
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-center max-w-lg">
          <div className="mb-6 text-6xl">🔧</div>
          <h1 className="text-[32px] font-black text-white mb-3 tracking-tight">Automations Coming Soon</h1>
          <p className="text-[16px] text-white/60 leading-relaxed mb-8">
            We're building powerful automation tools to help you manage your communities more efficiently. This feature will be available soon.
          </p>
          <div className="bg-[#111] border border-white/[0.08] rounded-xl p-6 text-left">
            <h2 className="text-[14px] font-bold text-white/80 uppercase tracking-wider mb-4">What's coming</h2>
            <ul className="space-y-3 text-[14px] text-white/60">
              <li className="flex items-start gap-3">
                <span className="text-[#9FFF57] font-bold mt-0.5">✓</span>
                <span>Automated welcome messages for new members</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#9FFF57] font-bold mt-0.5">✓</span>
                <span>Scheduled announcements and messages</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#9FFF57] font-bold mt-0.5">✓</span>
                <span>Member lifecycle automation (onboarding, renewal, expiry)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#9FFF57] font-bold mt-0.5">✓</span>
                <span>Custom workflow triggers and actions</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
