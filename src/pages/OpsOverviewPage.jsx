import { Link, useOutletContext } from 'react-router-dom'
import { Activity, AlertTriangle, CreditCard, LifeBuoy, Users, Waypoints } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Card, { CardBody, CardHeader } from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'

export default function OpsOverviewPage() {
  const { summary } = useOutletContext() || {}

  return (
    <>
      <PageHeader
        eyebrow="Membba Staff"
        title="Operations overview"
        description="Monitor platform health, support load, pending payments, and creator activity from one internal console."
        action={<Button as={Link} to="/membba-staff/helpdesk" variant="primary"><LifeBuoy size={15} /> Open Help Desk</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Creators" value={summary?.creators || 0} />
        <StatCard label="Communities" value={summary?.communities || 0} />
        <StatCard label="Active subs" value={summary?.active_subscriptions || 0} tone="success" />
        <StatCard label="Open issues" value={summary?.open_escalations || 0} tone={summary?.open_escalations ? 'warning' : 'neutral'} />
        <StatCard label="Pending pay" value={summary?.pending_payments || 0} tone={summary?.pending_payments ? 'warning' : 'neutral'} />
        <StatCard label="Revenue" value={`₦${Number(summary?.total_revenue || 0).toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Internal issue queue" description="Internal queue for creator-reported issues, AI escalations, and payment checks." />
          <CardBody>
            <div className="space-y-3">
              <Link to="/membba-staff/helpdesk" className="flex items-center justify-between rounded-[var(--radius-default)] border border-[var(--color-border-default)] p-3 hover:bg-[var(--color-bg-elevated)]">
                <span className="flex items-center gap-2 text-[13px] font-medium"><AlertTriangle size={16} /> Open issues</span>
                <span className="font-mono text-[13px] text-[var(--color-warning)]">{summary?.open_escalations || 0}</span>
              </Link>
              <Link to="/membba-staff/helpdesk" className="flex items-center justify-between rounded-[var(--radius-default)] border border-[var(--color-border-default)] p-3 hover:bg-[var(--color-bg-elevated)]">
                <span className="flex items-center gap-2 text-[13px] font-medium"><CreditCard size={16} /> Payment checks</span>
                <span className="font-mono text-[13px] text-[var(--color-warning)]">{summary?.pending_payments || 0}</span>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Common tasks" description="Fast paths for the staff team." />
          <CardBody>
            <div className="grid gap-2">
              <Link to="/membba-staff/helpdesk" className="btn-secondary justify-start"><CreditCard size={15} /> Lookup payment reference</Link>
              <Link to="/membba-staff/helpdesk" className="btn-secondary justify-start"><Users size={15} /> Search member or phone</Link>
              <Link to="/membba-staff/helpdesk" className="btn-secondary justify-start"><Waypoints size={15} /> Search community slug</Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="System notes" description="What Ops should watch today." />
          <CardBody>
            <div className="space-y-3 text-[13px] text-[var(--color-text-secondary)]">
              <p>WhatsApp/Baileys linking is still parked as an integration issue.</p>
              <p>Use payment verify/repair for “paid but no access” reports.</p>
              <p>Use creator detail pages for a full account support view.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
