import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getUser, isLoggedIn, logout } from '../lib/auth'
import UpgradeModal from '../components/UpgradeModal'
import './CandidateDashboardPage.css'

const DASHBOARD_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  sidebarItems: [
    { id: 'dashboard', label: 'Dashboard', path: '/candidate/dashboard' },
    { id: 'job-search', label: 'Job Search', path: '/candidate/job-search' },
    { id: 'applications', label: 'My Applications', path: '/candidate/my-applications' },
    { id: 'profile', label: 'Edit Profile', path: '/candidate-signup/candidate' },
  ],
  sidebarFooter: { id: 'logout', label: 'Logout' },
  searchPlaceholder: 'Search jobs by title or keyword…',
  searchButton: 'Search',
  recommendedTitle: 'Recommended for you',
  viewDetails: 'View Details',
  membership: {
    label: 'Membership:',
    nonMember: 'Non-Member',
    member: 'Member',
    upgrade: 'Upgrade to Membership',
  },
  emptyState: 'No recommendations yet. Add skills and preferences to your profile.',
  loadingState: 'Loading recommendations…',
}

function CandidateDashboardPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeNav] = useState('dashboard')
  const [isMember, setIsMember] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [user] = useState(getUser())
  const [showUpgrade, setShowUpgrade] = useState(false)

  const themeVars = useMemo(
    () => ({
      '--dash-bg': '#F8FAFC',
      '--dash-surface': '#FFFFFF',
      '--dash-border': '#E2E8F0',
      '--dash-heading': '#1E293B',
      '--dash-body': '#64748B',
      '--dash-primary': '#2563EB',
    }),
    [],
  )

  useEffect(() => {
    // Guard: redirect to login if no session.
    if (!isLoggedIn()) {
      navigate('/login')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const resp = await api.get('/candidate/recommendations')
        if (cancelled) return
        setRecommendations(resp.recommendations || [])
        setIsMember(!!resp.is_member)
      } catch (err) {
        if (!cancelled) {
          // Profile may not exist yet — direct user to fill it in.
          if (err.status === 404) {
            setFeedback('Please complete your profile to see recommendations.')
          } else {
            setFeedback(err.message || 'Could not load recommendations.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recommendations
    return recommendations.filter(
      (j) =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.company?.name || '').toLowerCase().includes(q) ||
        (j.matched_skills || []).some((t) => t.toLowerCase().includes(q)),
    )
  }, [recommendations, query])

  const goNav = (item) => {
    if (item.id === 'logout') {
      logout()
      navigate('/login')
      return
    }
    navigate(item.path)
  }

  const onViewDetails = (job) => {
    sessionStorage.setItem('job-details-source', 'dashboard')
    navigate(`/candidate/job-details?source=dashboard`, {
      state: { job, source: 'dashboard' },
    })
  }

  const formatSalary = (job) => {
    if (job.salary_min != null && job.salary_max != null) {
      const c = job.currency || 'AUD'
      return `${c} ${Number(job.salary_min).toLocaleString()} – ${Number(job.salary_max).toLocaleString()}`
    }
    return 'Salary not listed'
  }

  return (
    <div className="dash-page" style={themeVars}>
      <aside className="dash-sidebar">
        <button className="dash-brand" type="button" onClick={() => navigate('/')}>
          <span className="dash-brand-icon">{DASHBOARD_CONFIG.brand.glyph}</span>
          <span>{DASHBOARD_CONFIG.brand.name}</span>
        </button>
        <nav className="dash-nav">
          {DASHBOARD_CONFIG.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dash-nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => goNav(item)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="dash-nav-item dash-logout"
          onClick={() => goNav(DASHBOARD_CONFIG.sidebarFooter)}
        >
          {DASHBOARD_CONFIG.sidebarFooter.label}
        </button>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1>Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!</h1>
            <p>Here are roles matched to your profile.</p>
          </div>
          <div className="dash-membership">
            <div className="dash-membership-row">
              <span>{DASHBOARD_CONFIG.membership.label}</span>
              <span className="dash-pill">
                {isMember ? DASHBOARD_CONFIG.membership.member : DASHBOARD_CONFIG.membership.nonMember}
              </span>
            </div>
            <button
              type="button"
              className="dash-upgrade"
              disabled={isMember}
              onClick={() => setShowUpgrade(true)}
            >
              {isMember ? DASHBOARD_CONFIG.membership.member : DASHBOARD_CONFIG.membership.upgrade}
            </button>
          </div>
        </header>

        <div className="dash-search-row">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={DASHBOARD_CONFIG.searchPlaceholder}
            aria-label={DASHBOARD_CONFIG.searchPlaceholder}
          />
          <button type="button" onClick={() => navigate('/candidate/job-search')}>
            {DASHBOARD_CONFIG.searchButton}
          </button>
        </div>

        <section className="dash-section">
          <h2>{DASHBOARD_CONFIG.recommendedTitle}</h2>
          {loading ? (
            <p>{DASHBOARD_CONFIG.loadingState}</p>
          ) : filteredJobs.length === 0 ? (
            <p>{DASHBOARD_CONFIG.emptyState}</p>
          ) : (
            <div className="dash-job-list">
              {filteredJobs.map((job) => (
                <article key={job.job_id} className="dash-job-card">
                  <div>
                    <h3>{job.title}</h3>
                    <p className="dash-job-meta">
                      {job.company?.name || 'Unknown company'} · {job.location || '—'} · {(job.job_type || '').replace('_', '-')}
                    </p>
                    <p className="dash-job-salary">{formatSalary(job)}</p>
                    <div className="dash-tags">
                      {(job.matched_skills || []).map((t) => (
                        <span key={t} className="dash-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="dash-job-actions">
                    <span className="dash-match">{Math.round(job.match_score || 0)}% match</span>
                    <button type="button" onClick={() => onViewDetails(job)}>
                      {DASHBOARD_CONFIG.viewDetails}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="dash-feedback" aria-live="polite">{feedback}</p>
      </main>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onSuccess={() => {
          setIsMember(true)
          setFeedback('Welcome to Premium! You can now see all recommendations.')
        }}
        roleEndpoint="/candidate/upgrade"
      />
    </div>
  )
}

export default CandidateDashboardPage
