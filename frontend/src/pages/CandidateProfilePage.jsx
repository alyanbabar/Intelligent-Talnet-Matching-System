import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { isLoggedIn, register, getUser } from '../lib/auth'
import './CandidateProfilePage.css'

// This page serves two purposes:
//   1. First-time signup as a candidate (creates an account on the backend).
//   2. Editing an existing candidate's profile.
// We figure out which mode we're in from isLoggedIn().

const CANDIDATE_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  titleSignup: 'Create Your Profile',
  titleEdit: 'Edit Your Profile',
  subtitle: 'Tell us about yourself so we can match you with the right roles.',
  // Account-creation fields (only shown when not logged in)
  accountFields: [
    { id: 'password', label: 'Password', placeholder: 'Choose a password', type: 'password' },
  ],
  // Profile fields
  profileFields: [
    { id: 'fullName', label: 'Full Name', placeholder: 'Enter full name', type: 'text' },
    { id: 'email', label: 'Email', placeholder: 'Enter email', type: 'email' },
    { id: 'phone', label: 'Phone', placeholder: 'Enter phone', type: 'text' },
    { id: 'location', label: 'Preferred Location', placeholder: 'City, Country', type: 'text' },
    { id: 'years', label: 'Years of Experience', placeholder: 'e.g. 2', type: 'number' },
    { id: 'headline', label: 'Headline', placeholder: 'e.g. Junior Backend Engineer', type: 'text' },
  ],
  workPreference: {
    title: 'Work Preference',
    options: [
      { id: 'REMOTE', label: 'Remote' },
      { id: 'HYBRID', label: 'Hybrid' },
      { id: 'ONSITE', label: 'On-site' },
    ],
  },
  skills: {
    title: 'Skills',
    placeholder: 'Comma-separated, e.g. Python, SQL, React',
  },
  bio: {
    title: 'About You',
    placeholder: 'Short bio that recruiters will see…',
  },
  actions: {
    signup: 'Create Account and Continue',
    save: 'Save Profile',
  },
}

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  location: '',
  years: '',
  headline: '',
  workPreference: '',
  skills: '',
  bio: '',
}

function CandidateProfilePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState(initialForm)
  const [resumeFile, setResumeFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [isEditMode] = useState(isLoggedIn())

  const themeVars = useMemo(
    () => ({
      '--cp-bg': '#F8FAFC',
      '--cp-surface': '#FFFFFF',
      '--cp-heading': '#1E293B',
      '--cp-body': '#64748B',
      '--cp-border': '#E2E8F0',
      '--cp-primary': '#2563EB',
    }),
    [],
  )

  // If editing, pull the current profile from the backend.
  useEffect(() => {
    if (!isEditMode) return
    let cancelled = false
    ;(async () => {
      try {
        const resp = await api.get('/candidate/profile')
        if (cancelled) return
        const p = resp.profile || {}
        const cached = getUser() || {}
        setForm({
          fullName: p.full_name || '',
          email: cached.email || '',
          password: '',
          phone: p.phone || '',
          location: p.preferred_location || '',
          years: p.years_of_experience != null ? String(p.years_of_experience) : '',
          headline: p.headline || '',
          workPreference: p.preferred_working_mode || '',
          skills: (p.skills || []).map((s) => s.name).join(', '),
          bio: p.bio || '',
        })
      } catch (err) {
        if (!cancelled) setFeedback(err.message || 'Could not load profile.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEditMode])

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  // We keep the filename only — uploads are not supported by the backend yet.
  const onFile = (fileList) => {
    const file = fileList?.[0]
    if (file) setResumeFile(file.name)
  }

  const buildProfilePayload = () => ({
    full_name: form.fullName,
    phone: form.phone || null,
    headline: form.headline || null,
    bio: form.bio || null,
    preferred_location: form.location || null,
    preferred_working_mode: form.workPreference || null,
    years_of_experience: form.years ? Number(form.years) : null,
    skills: form.skills, // backend accepts comma-separated string
  })

  const onSubmit = async () => {
    if (!form.fullName.trim()) {
      setFeedback('Please enter your full name.')
      return
    }

    setBusy(true)
    try {
      if (!isEditMode) {
        // Signup flow: create the account first.
        if (!form.email.trim() || !form.password) {
          setFeedback('Email and password are required to create an account.')
          setBusy(false)
          return
        }
        setFeedback('Creating your account…')
        await register({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'candidate',
        })
        // Now logged in — save the profile details too.
        setFeedback('Saving your profile…')
        await api.post('/candidate/profile', buildProfilePayload())
        setFeedback('Profile saved. Redirecting…')
        navigate('/candidate/dashboard')
      } else {
        setFeedback('Saving…')
        await api.post('/candidate/profile', buildProfilePayload())
        setFeedback('Profile saved.')
      }
    } catch (err) {
      setFeedback(err.message || 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="candidate-profile-page" style={themeVars}>
      <header className="cp-header">
        <div className="cp-wrap">
          <button className="cp-brand" type="button" onClick={() => navigate('/')}>
            <span className="cp-brand-icon">{CANDIDATE_CONFIG.brand.glyph}</span>
            <span>{CANDIDATE_CONFIG.brand.name}</span>
          </button>
        </div>
      </header>

      <main className="cp-main">
        <div className="cp-wrap">
          <section className="cp-card">
            {isEditMode ? (
              <button
                type="button"
                className="cp-back"
                onClick={() => navigate('/candidate/dashboard')}
              >
                ← Back to dashboard
              </button>
            ) : null}
            <h1>{isEditMode ? CANDIDATE_CONFIG.titleEdit : CANDIDATE_CONFIG.titleSignup}</h1>
            <p className="cp-sub">{CANDIDATE_CONFIG.subtitle}</p>

            <div className="cp-grid">
              {CANDIDATE_CONFIG.profileFields.map((f) => (
                <label key={f.id} className="cp-field">
                  <span>{f.label}</span>
                  <input
                    name={f.id}
                    type={f.type}
                    value={form[f.id]}
                    onChange={onChange}
                    placeholder={f.placeholder}
                    disabled={f.id === 'email' && isEditMode}
                  />
                </label>
              ))}

              {/* Only show password when creating an account */}
              {!isEditMode && CANDIDATE_CONFIG.accountFields.map((f) => (
                <label key={f.id} className="cp-field">
                  <span>{f.label}</span>
                  <input
                    name={f.id}
                    type={f.type}
                    value={form[f.id]}
                    onChange={onChange}
                    placeholder={f.placeholder}
                    autoComplete="new-password"
                  />
                </label>
              ))}
            </div>

            <h2 className="cp-section-title">{CANDIDATE_CONFIG.workPreference.title}</h2>
            <div className="cp-radio-row">
              {CANDIDATE_CONFIG.workPreference.options.map((opt) => (
                <label key={opt.id} className="cp-radio">
                  <input
                    type="radio"
                    name="workPreference"
                    value={opt.id}
                    checked={form.workPreference === opt.id}
                    onChange={onChange}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <h2 className="cp-section-title">{CANDIDATE_CONFIG.skills.title}</h2>
            <input
              className="cp-input"
              name="skills"
              value={form.skills}
              onChange={onChange}
              placeholder={CANDIDATE_CONFIG.skills.placeholder}
            />

            <h2 className="cp-section-title">{CANDIDATE_CONFIG.bio.title}</h2>
            <textarea
              className="cp-textarea"
              name="bio"
              value={form.bio}
              onChange={onChange}
              placeholder={CANDIDATE_CONFIG.bio.placeholder}
              rows={4}
            />

            <h2 className="cp-section-title">Resume (optional)</h2>
            <div
              className={`cp-drop ${dragActive ? 'is-active' : ''}`}
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                onFile(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              role="presentation"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                hidden
                onChange={(e) => onFile(e.target.files)}
              />
              <p>{resumeFile || 'Drag and drop or click to browse (not yet uploaded to server)'}</p>
            </div>

            <div className="cp-actions">
              {isEditMode ? (
                <button
                  type="button"
                  className="cp-ghost"
                  onClick={() => navigate('/candidate/dashboard')}
                  disabled={busy}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                className="cp-primary"
                onClick={onSubmit}
                disabled={busy}
              >
                {busy
                  ? 'Saving…'
                  : isEditMode
                  ? CANDIDATE_CONFIG.actions.save
                  : CANDIDATE_CONFIG.actions.signup}
              </button>
            </div>

            <p className="cp-feedback" aria-live="polite">
              {feedback}
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default CandidateProfilePage