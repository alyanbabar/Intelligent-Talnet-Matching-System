import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { isLoggedIn, logout } from '../lib/auth'
import './CandidateJobSearchPage.css'

const JOB_SEARCH_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  sidebarItems: [
    { id: 'dashboard', label: 'Dashboard', path: '/candidate/dashboard' },
    { id: 'job-search', label: 'Job Search', path: '/candidate/job-search' },
    { id: 'applications', label: 'My Applications', path: '/candidate/my-applications' },
    { id: 'profile', label: 'Edit Profile', path: '/candidate-signup/candidate' },
  ],
  sidebarFooter: { id: 'logout', label: 'Logout' },
  title: 'Job Search',
  subtitle: 'Filter and search roles that fit your skills.',
  filters: {
    typeLabel: 'Job type',
    locationLabel: 'Location',
    workModeLabel: 'Work mode',
  },
  searchPlaceholder: 'Search by title, company, or skill…',
  searchButton: 'Search',
  viewDetails: 'View Details',
  loadingState: 'Loading jobs…',
  emptyState: 'No roles match your filters.',
}

const JOB_TYPES = ['All', 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY']
const WORK_MODES = ['All', 'REMOTE', 'ONSITE', 'HYBRID']
const LABELS = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  TEMPORARY: 'Temporary',
  REMOTE: 'Remote',
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
}

function CandidateJobSearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [jobType, setJobType] = useState('All')
  const [workMode, setWorkMode] = useState('All')
  const [locationFilter, setLocationFilter] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  const themeVars = useMemo(
    () => ({
      '--js-bg': '#F8FAFC',
      '--js-surface': '#FFFFFF',
      '--js-border': '#E2E8F0',
      '--js-heading': '#1E293B',
      '--js-body': '#64748B',
      '--js-primary': '#2563EB',
    }),
    [],
  )

  const doSearch = useCallback(async () => {
    setLoading(true)
    setFeedback('')
    try {
      const params = {}
      if (query.trim()) params.keyword = query.trim()
      if (jobType !== 'All') params.job_type = jobType
      if (workMode !== 'All') params.working_mode = workMode
      if (locationFilter.trim()) params.location = locationFilter.trim()
      const resp = await api.get('/candidate/search/jobs', params)
      setResults(resp.results || [])
      setFeedback(`Showing ${resp.result_count || 0} roles`)
    } catch (err) {
      setFeedback(err.message || 'Search failed.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, jobType, workMode, locationFilter])

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login')
      return
    }
    doSearch()
    // Intentionally only on mount — search re-runs explicitly via button or Enter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goNav = (item) => {
    if (item.id === 'logout') {
      logout()
      navigate('/login')
      return
    }
    navigate(item.path)
  }

  const onViewDetails = (job) => {
    sessionStorage.setItem('job-details-source', 'job-search')
    navigate(`/candidate/job-details?source=job-search`, {
      state: { job, source: 'job-search' },
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
    <div className="job-search-page" style={themeVars}>
      <aside className="js-sidebar">
        <button className="js-brand" type="button" onClick={() => navigate('/')}>
          <span className="js-brand-icon">{JOB_SEARCH_CONFIG.brand.glyph}</span>
          <span>{JOB_SEARCH_CONFIG.brand.name}</span>
        </button>
        <nav className="js-nav">
          {JOB_SEARCH_CONFIG.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`js-nav-item ${item.id === 'job-search' ? 'active' : ''}`}
              onClick={() => goNav(item)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="js-nav-item js-logout" onClick={() => goNav(JOB_SEARCH_CONFIG.sidebarFooter)}>
          {JOB_SEARCH_CONFIG.sidebarFooter.label}
        </button>
      </aside>

      <main className="js-main">
        <header className="js-header">
          <h1>{JOB_SEARCH_CONFIG.title}</h1>
          <p>{JOB_SEARCH_CONFIG.subtitle}</p>
        </header>

        <section className="js-filters">
          <label className="js-filter">
            <span>{JOB_SEARCH_CONFIG.filters.typeLabel}</span>
            <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>{LABELS[t] || t}</option>
              ))}
            </select>
          </label>
          <label className="js-filter">
            <span>{JOB_SEARCH_CONFIG.filters.workModeLabel}</span>
            <select value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
              {WORK_MODES.map((t) => (
                <option key={t} value={t}>{LABELS[t] || t}</option>
              ))}
            </select>
          </label>
          <label className="js-filter">
            <span>{JOB_SEARCH_CONFIG.filters.locationLabel}</span>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="e.g. Wollongong"
            />
          </label>
          <div className="js-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
              placeholder={JOB_SEARCH_CONFIG.searchPlaceholder}
              aria-label={JOB_SEARCH_CONFIG.searchPlaceholder}
            />
            <button type="button" onClick={doSearch}>
              {JOB_SEARCH_CONFIG.searchButton}
            </button>
          </div>
        </section>

        <div className="js-results">
          {loading ? (
            <p>{JOB_SEARCH_CONFIG.loadingState}</p>
          ) : results.length === 0 ? (
            <p className="js-empty">{JOB_SEARCH_CONFIG.emptyState}</p>
          ) : (
            results.map((job) => (
              <article key={job.job_id} className="js-card">
                <div>
                  <h2>{job.title}</h2>
                  <p className="js-meta">
                    {job.company?.name || 'Unknown company'} · {job.location || '—'} · {LABELS[job.job_type] || job.job_type}
                  </p>
                  <p className="js-salary">{formatSalary(job)}</p>
                </div>
                <div className="js-card-actions">
                  <button type="button" onClick={() => onViewDetails(job)}>
                    {JOB_SEARCH_CONFIG.viewDetails}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <p className="js-feedback" aria-live="polite">{feedback}</p>
      </main>
    </div>
  )
}

export default CandidateJobSearchPage
