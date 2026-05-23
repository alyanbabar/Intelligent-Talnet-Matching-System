import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { isLoggedIn, logout } from '../lib/auth'
import './CandidateMyApplicationsPage.css'

const MY_APPLICATIONS_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  sidebarItems: [
    { id: 'dashboard', label: 'Dashboard', path: '/candidate/dashboard' },
    { id: 'job-search', label: 'Job Search', path: '/candidate/job-search' },
    { id: 'applications', label: 'My Applications', path: '/candidate/my-applications' },
    { id: 'profile', label: 'Edit Profile', path: '/candidate-signup/candidate' },
  ],
  sidebarFooter: { id: 'logout', label: 'Logout' },
  title: 'My Applications',
  subtitle: 'Track roles you have applied to.',
  emptyHint: 'No applications yet. Browse jobs and apply to roles you like.',
  datePrefix: 'Applied on',
  viewLabel: 'View',
  loadingState: 'Loading…',
}

// Map backend application status (UPPER_CASE) to friendly labels and css classes.
const STATUS_LABEL = {
  PENDING: 'Pending',
  REVIEWED: 'Reviewed',
  SHORTLISTED: 'Shortlisted',
  INTERVIEWED: 'Interviewed',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

function formatAppliedDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function CandidateMyApplicationsPage() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  const themeVars = useMemo(
    () => ({
      '--ma-bg': '#F8FAFC',
      '--ma-surface': '#FFFFFF',
      '--ma-border': '#E2E8F0',
      '--ma-heading': '#1E293B',
      '--ma-body': '#64748B',
      '--ma-primary': '#2563EB',
    }),
    [],
  )

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const resp = await api.get('/candidate/applications')
        if (!cancelled) setApplications(resp.applications || [])
      } catch (err) {
        if (!cancelled) setFeedback(err.message || 'Could not load applications.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [navigate])

  const goNav = (item) => {
    if (item.id === 'logout') {
      logout()
      navigate('/login')
      return
    }
    navigate(item.path)
  }

  const onView = (app) => {
    if (app.job) {
      sessionStorage.setItem('job-details-source', 'applications')
      navigate(`/candidate/job-details?source=applications`, {
        state: { job: app.job, source: 'applications' },
      })
    }
  }

  return (
    <div className="ma-page" style={themeVars}>
      <aside className="ma-sidebar">
        <button className="ma-brand" type="button" onClick={() => navigate('/')}>
          <span className="ma-brand-icon">{MY_APPLICATIONS_CONFIG.brand.glyph}</span>
          <span>{MY_APPLICATIONS_CONFIG.brand.name}</span>
        </button>
        <nav className="ma-nav">
          {MY_APPLICATIONS_CONFIG.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ma-nav-item ${item.id === 'applications' ? 'active' : ''}`}
              onClick={() => goNav(item)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="ma-nav-item ma-logout" onClick={() => goNav(MY_APPLICATIONS_CONFIG.sidebarFooter)}>
          {MY_APPLICATIONS_CONFIG.sidebarFooter.label}
        </button>
      </aside>

      <main className="ma-main">
        <header className="ma-header">
          <h1>{MY_APPLICATIONS_CONFIG.title}</h1>
          <p>{MY_APPLICATIONS_CONFIG.subtitle}</p>
        </header>

        <div className="ma-list">
          {loading ? (
            <p className="ma-empty">{MY_APPLICATIONS_CONFIG.loadingState}</p>
          ) : applications.length === 0 ? (
            <p className="ma-empty">{MY_APPLICATIONS_CONFIG.emptyHint}</p>
          ) : (
            applications.map((app) => {
              const role = app.job?.title || 'Role'
              const company = app.job?.company?.name || ''
              const status = app.status || 'PENDING'
              const statusClass = status.toLowerCase()
              return (
                <article key={app.application_id} className="ma-row">
                  <div>
                    <h2>{role}</h2>
                    <p className="ma-company">{company}</p>
                    <p className="ma-date">
                      {MY_APPLICATIONS_CONFIG.datePrefix} {formatAppliedDate(app.applied_at)}
                    </p>
                  </div>
                  <div className="ma-right">
                    <span className={`ma-status ma-status-${statusClass}`}>
                      {STATUS_LABEL[status] || status}
                    </span>
                    <button type="button" onClick={() => onView(app)}>
                      {MY_APPLICATIONS_CONFIG.viewLabel}
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <p className="ma-feedback" aria-live="polite">{feedback}</p>
      </main>
    </div>
  )
}

export default CandidateMyApplicationsPage
