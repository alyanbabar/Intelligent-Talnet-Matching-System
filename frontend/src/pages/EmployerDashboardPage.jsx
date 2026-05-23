import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getUser, isLoggedIn, logout } from '../lib/auth'
import UpgradeModal from '../components/UpgradeModal'
import './EmployerDashboardPage.css'

const EMPLOYER_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  sidebarItems: [
    { id: 'dashboard', label: 'Dashboard', path: '/employer/dashboard' },
    { id: 'create-job', label: 'Create Job', path: '/employer/create-job' },
    { id: 'find-candidates', label: 'Find Candidates', path: '/employer/find-candidates' },
  ],
  sidebarFooter: { id: 'logout', label: 'Logout' },
  title: 'Employer Dashboard',
  subtitle: 'Manage your job postings and review applications',
  membership: {
    label: 'Membership:',
    nonMember: 'Non-Member',
    member: 'Member',
    upgrade: 'Upgrade to Membership',
  },
  jobsTitle: 'Your Posted Jobs',
  noJobs: "You haven't posted any jobs yet. Click Create Job to get started.",
  viewApplications: 'View Applications',
  recommendedCandidates: 'Recommended Candidates',
}

const STATUS_LABEL = {
  PENDING: 'Pending', REVIEWED: 'Reviewed', SHORTLISTED: 'Shortlisted',
  INTERVIEWED: 'Interviewed', ACCEPTED: 'Accepted', REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

function EmployerDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [activeJobApplications, setActiveJobApplications] = useState(null)
  const [activeJob, setActiveJob] = useState(null)
  const [user, setUser] = useState(getUser())
  const [showUpgrade, setShowUpgrade] = useState(false)

  const themeVars = useMemo(
    () => ({
      '--emp-white': '#FFFFFF',
      '--emp-page-bg': '#F8FAFC',
      '--emp-border': '#E2E8F0',
      '--emp-primary': '#2563EB',
      '--emp-heading': '#1E293B',
      '--emp-body': '#64748B',
      '--emp-membership-bg': '#F3F4F6',
      '--emp-membership-text': '#364153',
      '--emp-chip-bg': '#EFF6FF',
      '--emp-stat-1': '#DBEAFE',
      '--emp-stat-2': '#DCFCE7',
      '--emp-stat-3': '#FFF7ED',
      '--emp-match-bg': '#DCFCE7',
      '--emp-match-text': '#008236',
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
        const resp = await api.get('/employer/jobs')
        if (!cancelled) setJobs(resp.jobs || [])
      } catch (err) {
        if (!cancelled) setFeedback(err.message || 'Could not load your jobs.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [navigate, location.pathname])

  const onSidebarClick = (itemId) => {
    if (itemId === 'logout') {
      logout()
      navigate('/login')
      return
    }
    const item = EMPLOYER_CONFIG.sidebarItems.find((i) => i.id === itemId)
    if (item) navigate(item.path)
  }

  const openApplications = async (job) => {
    setActiveJob(job)
    setActiveJobApplications(null)
    try {
      const resp = await api.get(`/employer/jobs/${job.job_id}/applications`)
      setActiveJobApplications(resp.applications || [])
    } catch (err) {
      setFeedback(err.message || 'Could not load applications for this job.')
      setActiveJob(null)
    }
  }

  const updateStatus = async (application, newStatus) => {
    try {
      await api.put(`/employer/applications/${application.application_id}/status`, {
        status: newStatus,
      })
      setActiveJobApplications((prev) =>
        prev.map((a) =>
          a.application_id === application.application_id ? { ...a, status: newStatus } : a,
        ),
      )
      setFeedback(`Status updated to ${STATUS_LABEL[newStatus] || newStatus}`)
    } catch (err) {
      setFeedback(err.message || 'Could not update status.')
    }
  }

  const totalJobs = jobs.length
  const activeJobs = jobs.filter((j) => j.is_active !== false).length

  return (
    <div className="employer-page" style={themeVars}>
      <aside className="employer-sidebar">
        <div className="employer-brand-wrap">
          <button className="employer-brand" type="button" onClick={() => navigate('/')}>
            <span className="employer-brand-icon">{EMPLOYER_CONFIG.brand.glyph}</span>
            <span className="employer-brand-text">{EMPLOYER_CONFIG.brand.name}</span>
          </button>
        </div>

        <nav className="employer-nav">
          {EMPLOYER_CONFIG.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`employer-nav-item ${item.id === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSidebarClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="employer-nav-footer">
          <button
            type="button"
            className="employer-nav-item"
            onClick={() => onSidebarClick(EMPLOYER_CONFIG.sidebarFooter.id)}
          >
            {EMPLOYER_CONFIG.sidebarFooter.label}
          </button>
        </div>
      </aside>

      <main className="employer-main">
        <header className="employer-header">
          <div>
            <h1>{EMPLOYER_CONFIG.title}</h1>
            <p>{EMPLOYER_CONFIG.subtitle}{user?.full_name ? ` · ${user.full_name}` : ''}</p>
          </div>
          <div className="employer-membership">
            <div className="membership-line">
              <span>{EMPLOYER_CONFIG.membership.label}</span>
              <span className="membership-pill">
                {user?.is_member ? EMPLOYER_CONFIG.membership.member : EMPLOYER_CONFIG.membership.nonMember}
              </span>
            </div>
            <button
              type="button"
              className="upgrade-btn"
              disabled={user?.is_member}
              onClick={() => setShowUpgrade(true)}
            >
              {user?.is_member ? EMPLOYER_CONFIG.membership.member : EMPLOYER_CONFIG.membership.upgrade}
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <p>Active Jobs</p>
              <span className="stat-icon active-jobs">A</span>
            </div>
            <h2>{activeJobs}</h2>
          </article>
          <article className="stat-card">
            <div className="stat-top">
              <p>Total Jobs</p>
              <span className="stat-icon recommended">T</span>
            </div>
            <h2>{totalJobs}</h2>
          </article>
        </section>

        <section className="candidates-section">
          <h3>{EMPLOYER_CONFIG.jobsTitle}</h3>
          {loading ? (
            <p>Loading…</p>
          ) : jobs.length === 0 ? (
            <p>{EMPLOYER_CONFIG.noJobs}</p>
          ) : (
            <div className="candidate-list">
              {jobs.map((job) => (
                <article key={job.job_id} className="candidate-card">
                  <div>
                    <h4>{job.title}</h4>
                    <p>{job.location || '—'} · {(job.job_type || '').replace('_', '-')}</p>
                    <p>{(job.working_mode || '').toLowerCase()}</p>
                    <div className="skill-list">
                      {(job.required_skills || []).map((s) => (
                        <span key={s.name} className="skill-chip">{s.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="candidate-actions">
                    <div className="dash-cand-btns">
                      <button type="button" className="dash-view-profile"
                              onClick={() => openApplications(job)}>
                        {EMPLOYER_CONFIG.viewApplications}
                      </button>
                      <button type="button" className="dash-view-profile"
                              onClick={() => navigate(`/employer/find-candidates?jobId=${job.job_id}`)}>
                        {EMPLOYER_CONFIG.recommendedCandidates}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="employer-feedback" aria-live="polite">{feedback}</p>
      </main>

      {activeJob ? (
        <div
          className="emp-profile-modal-root"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveJob(null)
          }}
        >
          <div className="emp-profile-modal" role="dialog" aria-modal="true">
            <h2>Applications for {activeJob.title}</h2>
            {activeJobApplications === null ? (
              <p>Loading…</p>
            ) : activeJobApplications.length === 0 ? (
              <p>No applications yet for this role.</p>
            ) : (
              <div className="emp-app-list">
                {activeJobApplications.map((app) => (
                  <div key={app.application_id} className="emp-app-row">
                    <div>
                      <p className="emp-profile-name">{app.candidate_name}</p>
                      <p className="emp-profile-line">{app.candidate_email}</p>
                      <p className="emp-profile-line">
                        {app.candidate_headline || '—'} · {(app.candidate_skills || []).join(', ')}
                      </p>
                      {app.cover_letter ? (
                        <p className="emp-profile-body">{app.cover_letter}</p>
                      ) : null}
                    </div>
                    <div>
                      <select
                        value={app.status}
                        onChange={(e) => updateStatus(app, e.target.value)}
                      >
                        {Object.keys(STATUS_LABEL).map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="dash-view-profile" onClick={() => setActiveJob(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onSuccess={() => {
          setUser((u) => (u ? { ...u, is_member: true } : u))
          setFeedback('Welcome to Premium! Recommendations are now unlimited.')
        }}
        roleEndpoint="/employer/upgrade"
      />
    </div>
  )
}

export default EmployerDashboardPage
