import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { logout } from '../lib/auth'
import './CandidateJobDetailsPage.css'

const DETAILS_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  sidebarItems: [
    { id: 'dashboard', label: 'Dashboard', path: '/candidate/dashboard', source: 'dashboard' },
    { id: 'job-search', label: 'Job Search', path: '/candidate/job-search', source: 'job-search' },
    {
      id: 'applications',
      label: 'My Applications',
      path: '/candidate/my-applications',
      source: 'applications',
    },
  ],
  sidebarFooter: { id: 'logout', label: 'Logout' },
  applyLabel: 'Apply Now',
  backLabels: {
    dashboard: 'Back to Dashboard',
    'job-search': 'Back to Job Search',
    applications: 'Back to My Applications',
    default: 'Back',
  },
  applyModal: {
    title: 'Apply for this role',
    subtitle: 'Add a short note for the hiring team.',
    jobLine: 'Applying to',
    coverLabel: 'Cover letter or message',
    coverPlaceholder: 'Tell the employer why you are a great fit…',
    linkedinLabel: 'LinkedIn profile (optional)',
    linkedinPlaceholder: 'https://linkedin.com/in/…',
    cancel: 'Cancel',
    submit: 'Submit application',
    successTitle: 'Application sent',
    successBody: 'Done — check My Applications for this entry.',
    close: 'Close',
  },
}

// Build the display object from a job returned by the backend.
// Backend shape: { job_id, title, description, responsibilities, requirements,
//                  location, working_mode, job_type, salary_min, salary_max,
//                  currency, company: { name, industry }, ... }
function buildDetails(job) {
  if (!job) {
    return {
      title: 'Role',
      company: 'Company',
      location: 'Location',
      type: 'Full-time',
      salary: '',
      overview: 'No details available.',
      responsibilities: [],
      requirements: [],
    }
  }

  const formatSalary = () => {
    if (job.salary_min != null && job.salary_max != null) {
      const c = job.currency || 'AUD'
      return `${c} ${Number(job.salary_min).toLocaleString()} – ${Number(job.salary_max).toLocaleString()}`
    }
    return ''
  }

  const splitLines = (text) => {
    if (!text) return []
    return String(text)
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
  }

  const typeLabel = (job.job_type || 'FULL_TIME').replace('_', '-').toLowerCase()
  const typeLabelDisplay = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)

  const responsibilities = splitLines(job.responsibilities)
  const requirements = splitLines(job.requirements)

  return {
    title: job.title || 'Role',
    company: job.company?.name || 'Company',
    location: job.location || 'Location',
    type: typeLabelDisplay,
    salary: formatSalary(),
    overview: job.description || 'See description for details.',
    responsibilities: responsibilities.length
      ? responsibilities
      : ['See description for full responsibilities.'],
    requirements: requirements.length
      ? requirements
      : ['See description for full requirements.'],
  }
}

// Figure out which screen opened job details (drives back link + active nav).
function resolveSource(location, searchParams) {
  const fromState = location.state?.source
  const fromQuery = searchParams.get('source')
  const fromStorage = sessionStorage.getItem('job-details-source')
  const raw = fromState || fromQuery || fromStorage || 'job-search'
  if (raw === 'dashboard' || raw === 'job-search' || raw === 'applications') return raw
  return 'job-search'
}

function CandidateJobDetailsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const job = location.state?.job

  const openedFrom = useMemo(
    () => resolveSource(location, searchParams),
    [location.state, searchParams],
  )

  const detail = useMemo(() => buildDetails(job), [job])

  const [applyOpen, setApplyOpen] = useState(false)
  const [applyStep, setApplyStep] = useState('form')
  const [coverLetter, setCoverLetter] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [applyError, setApplyError] = useState('')

  const themeVars = useMemo(
    () => ({
      '--jd-bg': '#F8FAFC',
      '--jd-surface': '#FFFFFF',
      '--jd-border': '#E2E8F0',
      '--jd-heading': '#1E293B',
      '--jd-body': '#64748B',
      '--jd-primary': '#2563EB',
    }),
    [],
  )

  const backPath =
    openedFrom === 'dashboard'
      ? '/candidate/dashboard'
      : openedFrom === 'applications'
        ? '/candidate/my-applications'
        : '/candidate/job-search'

  const backLabel =
    DETAILS_CONFIG.backLabels[openedFrom] ?? DETAILS_CONFIG.backLabels.default

  const sidebarActive = (item) => {
    if (item.source === openedFrom) return 'active'
    if (openedFrom === 'applications' && item.id === 'applications') return 'active'
    return ''
  }

  const openApplyModal = () => {
    setApplyStep('form')
    setCoverLetter('')
    setLinkedinUrl('')
    setApplyError('')
    setApplyOpen(true)
  }

  const closeApplyModal = () => {
    setApplyOpen(false)
    setApplyStep('form')
    setApplyError('')
  }

  useEffect(() => {
    if (!applyOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeApplyModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyOpen])

  const submitApplication = async () => {
    const trimmed = coverLetter.trim()
    if (trimmed.length < 8) {
      setApplyError('Please add a short message (at least a few words).')
      return
    }
    if (!job?.job_id) {
      setApplyError('Cannot determine which job to apply to.')
      return
    }
    setApplyError('')
    try {
      await api.post(`/candidate/apply/${job.job_id}`, {
        cover_letter: trimmed,
      })
      setApplyStep('success')
    } catch (e) {
      // Common: 409 if already applied.
      setApplyError(e.message || 'Could not submit application.')
    }
  }

  const m = DETAILS_CONFIG.applyModal

  return (
    <div className="jd-page" style={themeVars}>
      <aside className="jd-sidebar">
        <button className="jd-brand" type="button" onClick={() => navigate('/')}>
          <span className="jd-brand-icon">{DETAILS_CONFIG.brand.glyph}</span>
          <span>{DETAILS_CONFIG.brand.name}</span>
        </button>
        <nav className="jd-nav">
          {DETAILS_CONFIG.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`jd-nav-item ${sidebarActive(item)}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="jd-nav-item jd-logout" onClick={() => { logout(); navigate('/login') }}>
          {DETAILS_CONFIG.sidebarFooter.label}
        </button>
      </aside>

      <main className="jd-main">
        <button type="button" className="jd-back" onClick={() => navigate(backPath)}>
          ← {backLabel}
        </button>

        <article className="jd-card">
          <header className="jd-card-head">
            <div>
              <h1>{detail.title}</h1>
              <p className="jd-meta">
                {detail.company} · {detail.location} · {detail.type}
              </p>
              {detail.salary ? <p className="jd-salary">{detail.salary}</p> : null}
            </div>
            <button type="button" className="jd-apply" onClick={openApplyModal}>
              {DETAILS_CONFIG.applyLabel}
            </button>
          </header>

          <section className="jd-section">
            <h2>Overview</h2>
            <p>{detail.overview}</p>
          </section>

          <section className="jd-section">
            <h2>Responsibilities</h2>
            <ul>
              {detail.responsibilities.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="jd-section">
            <h2>Requirements</h2>
            <ul>
              {detail.requirements.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </article>
      </main>

      {applyOpen ? (
        <div
          className="jd-modal-root"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeApplyModal()
          }}
        >
          <div className="jd-modal" role="dialog" aria-modal="true" aria-labelledby="apply-modal-title">
            {applyStep === 'form' ? (
              <>
                <h2 id="apply-modal-title">{m.title}</h2>
                <p className="jd-modal-sub">{m.subtitle}</p>
                <p className="jd-modal-job">
                  {m.jobLine}: <strong>{detail.title}</strong> — {detail.company}
                </p>

                <label className="jd-modal-field">
                  <span>{m.coverLabel}</span>
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder={m.coverPlaceholder}
                    rows={5}
                  />
                </label>

                <label className="jd-modal-field">
                  <span>{m.linkedinLabel}</span>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder={m.linkedinPlaceholder}
                  />
                </label>

                {applyError ? (
                  <p className="jd-modal-error" role="alert">
                    {applyError}
                  </p>
                ) : null}

                <div className="jd-modal-actions">
                  <button type="button" className="jd-modal-cancel" onClick={closeApplyModal}>
                    {m.cancel}
                  </button>
                  <button type="button" className="jd-modal-submit" onClick={submitApplication}>
                    {m.submit}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="apply-modal-title">{m.successTitle}</h2>
                <p className="jd-modal-sub">{m.successBody}</p>
                <div className="jd-modal-actions jd-modal-actions-single">
                  <button type="button" className="jd-modal-submit" onClick={closeApplyModal}>
                    {m.close}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CandidateJobDetailsPage
