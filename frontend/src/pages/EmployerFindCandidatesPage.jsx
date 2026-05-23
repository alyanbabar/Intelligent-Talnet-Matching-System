import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { isLoggedIn, logout } from '../lib/auth'
import './EmployerFindCandidatesPage.css'

const FIND_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  sidebarItems: [
    { id: 'dashboard', label: 'Dashboard', path: '/employer/dashboard' },
    { id: 'create-job', label: 'Create Job', path: '/employer/create-job' },
    { id: 'find-candidates', label: 'Find Candidates', path: '/employer/find-candidates' },
  ],
  sidebarFooter: { id: 'logout', label: 'Logout' },
  title: 'Find Candidates',
  subtitle: 'Search and discover qualified talent for your team',
  searchPlaceholder: 'Search candidates by name, skills, headline…',
  searchButton: 'Search',
  locationLabel: 'Location',
  workModeLabel: 'Preferred work mode',
  showingPrefix: 'Showing',
  showingSuffix: 'candidates',
  viewProfile: 'View Profile',
  modalTitle: 'Candidate profile',
  close: 'Close',
  loadingState: 'Loading…',
  emptyState: 'No candidates match your filters.',
  recommendedTitle: 'Recommended Candidates for this Job',
}

const WORK_MODES = [
  { value: 'all', label: 'All' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'ONSITE', label: 'On-site' },
  { value: 'HYBRID', label: 'Hybrid' },
]

function EmployerFindCandidatesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const jobIdParam = searchParams.get('jobId')

  const [query, setQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [workMode, setWorkMode] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [profileCandidate, setProfileCandidate] = useState(null)
  // If we arrived from a job's "recommended candidates" button.
  const [isRecommendedMode, setIsRecommendedMode] = useState(!!jobIdParam)

  const themeVars = useMemo(
    () => ({
      '--emp-white': '#FFFFFF',
      '--emp-page-bg': '#F8FAFC',
      '--emp-border': '#E2E8F0',
      '--emp-primary': '#2563EB',
      '--emp-heading': '#1E293B',
      '--emp-body': '#64748B',
      '--emp-chip-bg': '#EFF6FF',
      '--emp-match-bg': '#DCFCE7',
      '--emp-match-text': '#008236',
    }),
    [],
  )

  const fetchSearch = useCallback(async () => {
    setLoading(true)
    setFeedback('')
    try {
      const params = {}
      if (query.trim()) params.keyword = query.trim()
      if (locationFilter.trim()) params.location = locationFilter.trim()
      if (workMode !== 'all') params.working_mode = workMode
      const resp = await api.get('/employer/search/candidates', params)
      setResults(resp.results || [])
      setFeedback(`${FIND_CONFIG.showingPrefix} ${resp.result_count || 0} ${FIND_CONFIG.showingSuffix}`)
    } catch (err) {
      setResults([])
      setFeedback(err.message || 'Search failed.')
    } finally {
      setLoading(false)
    }
  }, [query, locationFilter, workMode])

  const fetchRecommended = useCallback(async (jobId) => {
    setLoading(true)
    setFeedback('')
    try {
      const resp = await api.get(`/employer/jobs/${jobId}/recommended-candidates`)
      setResults(resp.recommended_candidates || [])
      setFeedback(`Showing ${resp.recommendation_count || 0} recommended candidates`)
    } catch (err) {
      setResults([])
      setFeedback(err.message || 'Could not load recommended candidates.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login')
      return
    }
    if (jobIdParam) {
      fetchRecommended(jobIdParam)
    } else {
      fetchSearch()
    }
    // Intentionally only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goSidebar = (item) => {
    if (item.id === 'logout') {
      logout()
      navigate('/login')
      return
    }
    if (item.path) navigate(item.path)
  }

  const onSearch = () => {
    setIsRecommendedMode(false)
    fetchSearch()
  }

  return (
    <div className="employer-page employer-find-candidates-page" style={themeVars}>
      <aside className="employer-sidebar">
        <div className="employer-brand-wrap">
          <button className="employer-brand" type="button" onClick={() => navigate('/')}>
            <span className="employer-brand-icon">{FIND_CONFIG.brand.glyph}</span>
            <span className="employer-brand-text">{FIND_CONFIG.brand.name}</span>
          </button>
        </div>
        <nav className="employer-nav">
          {FIND_CONFIG.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`employer-nav-item ${item.id === 'find-candidates' ? 'active' : ''}`}
              onClick={() => goSidebar(item)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="employer-nav-footer">
          <button
            type="button"
            className="employer-nav-item"
            onClick={() => goSidebar(FIND_CONFIG.sidebarFooter)}
          >
            {FIND_CONFIG.sidebarFooter.label}
          </button>
        </div>
      </aside>

      <main className="employer-main efc-main">
        <header className="efc-header">
          <h1>{isRecommendedMode ? FIND_CONFIG.recommendedTitle : FIND_CONFIG.title}</h1>
          <p>{FIND_CONFIG.subtitle}</p>
        </header>

        {!isRecommendedMode && (
          <section className="efc-filters">
            <div className="efc-search-row">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
                placeholder={FIND_CONFIG.searchPlaceholder}
              />
              <button type="button" onClick={onSearch}>{FIND_CONFIG.searchButton}</button>
            </div>
            <div className="efc-filter-row">
              <label className="efc-filter">
                <span>{FIND_CONFIG.locationLabel}</span>
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="e.g. Wollongong"
                />
              </label>
              <label className="efc-filter">
                <span>{FIND_CONFIG.workModeLabel}</span>
                <select value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
                  {WORK_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        <div className="efc-results">
          {loading ? (
            <p>{FIND_CONFIG.loadingState}</p>
          ) : results.length === 0 ? (
            <p className="efc-empty">{FIND_CONFIG.emptyState}</p>
          ) : (
            results.map((cand) => (
              <article key={cand.candidate_id} className="candidate-card">
                <div>
                  <h4>{cand.candidate_name || cand.full_name}</h4>
                  <p>{cand.headline || '—'}</p>
                  <p>
                    {cand.years_of_experience != null ? `${cand.years_of_experience} yrs experience · ` : ''}
                    {cand.preferred_location || '—'}
                    {cand.preferred_working_mode ? ` · ${cand.preferred_working_mode.toLowerCase()}` : ''}
                  </p>
                  <div className="skill-list">
                    {(cand.skills || cand.matched_skills || []).map((skill) => (
                      <span key={skill} className="skill-chip">{skill}</span>
                    ))}
                  </div>
                </div>
                <div className="candidate-actions">
                  {cand.match_score != null && (
                    <div className="dash-cand-match-row">
                      <span className="match-pill">{Math.round(cand.match_score)}%</span>
                    </div>
                  )}
                  <div className="dash-cand-btns">
                    <button type="button" className="dash-view-profile"
                            onClick={() => setProfileCandidate(cand)}>
                      {FIND_CONFIG.viewProfile}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <p className="employer-feedback" aria-live="polite">{feedback}</p>
      </main>

      {profileCandidate ? (
        <div
          className="emp-profile-modal-root"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProfileCandidate(null)
          }}
        >
          <div className="emp-profile-modal" role="dialog" aria-modal="true">
            <h2>{FIND_CONFIG.modalTitle}</h2>
            <p className="emp-profile-name">{profileCandidate.candidate_name || profileCandidate.full_name}</p>
            <p className="emp-profile-line">{profileCandidate.candidate_email || profileCandidate.email}</p>
            <p className="emp-profile-line">{profileCandidate.headline}</p>
            <p className="emp-profile-body">{profileCandidate.bio || '—'}</p>
            <p className="emp-profile-line">
              <strong>Skills:</strong> {(profileCandidate.skills || []).join(', ') || '—'}
            </p>
            {profileCandidate.matched_skills?.length ? (
              <p className="emp-profile-line">
                <strong>Matched:</strong> {profileCandidate.matched_skills.join(', ')}
              </p>
            ) : null}
            <button type="button" className="dash-view-profile" onClick={() => setProfileCandidate(null)}>
              {FIND_CONFIG.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default EmployerFindCandidatesPage
