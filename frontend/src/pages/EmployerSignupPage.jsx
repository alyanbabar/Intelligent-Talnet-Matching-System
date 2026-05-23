import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../lib/auth'
import './EmployerSignupPage.css'

const EMPLOYER_SIGNUP_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  title: 'Create Employer Account',
  subtitle: 'Set up your company details to start hiring.',
  fields: [
    { id: 'fullName', label: 'Your Full Name', placeholder: 'Enter full name', type: 'text' },
    { id: 'workEmail', label: 'Work Email', placeholder: 'you@company.com', type: 'email' },
    { id: 'password', label: 'Password', placeholder: 'Choose a password', type: 'password' },
    { id: 'companyName', label: 'Company Name', placeholder: 'Enter company name', type: 'text' },
    { id: 'companyWebsite', label: 'Company Website', placeholder: 'https://...', type: 'text' },
    { id: 'industry', label: 'Industry', placeholder: 'e.g. Software', type: 'text' },
  ],
  companySize: ['1-10', '11-50', '51-200', '201-500', '500+'],
  labels: {
    companySize: 'Company Size',
    companyDescription: 'Company Description',
  },
  placeholders: {
    companySize: 'Select company size',
    companyDescription: 'Briefly describe your company and hiring goals…',
  },
  actions: {
    submit: 'Create Account',
  },
}

const initialForm = {
  fullName: '',
  workEmail: '',
  password: '',
  companyName: '',
  companyWebsite: '',
  industry: '',
  companySize: '',
  companyDescription: '',
}

function EmployerSignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [feedback, setFeedback] = useState('Fill in employer details to continue')
  const [busy, setBusy] = useState(false)

  const themeVars = useMemo(
    () => ({
      '--employer-signup-bg': '#F8FAFC',
      '--employer-signup-surface': '#FFFFFF',
      '--employer-signup-heading': '#1E293B',
      '--employer-signup-body': '#64748B',
      '--employer-signup-primary': '#2563EB',
      '--employer-signup-border': '#E2E8F0',
    }),
    [],
  )

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const onSubmit = async () => {
    if (!form.fullName.trim() || !form.workEmail.trim() || !form.password || !form.companyName.trim()) {
      setFeedback('Full name, email, password, and company name are required.')
      return
    }
    setBusy(true)
    setFeedback('Creating your account…')
    try {
      await register({
        full_name: form.fullName.trim(),
        email: form.workEmail.trim(),
        password: form.password,
        role: 'employer',
        company_name: form.companyName.trim(),
      })
      // NB: the additional company fields (industry, website, size, description)
      // aren't yet supported by the backend's register payload. The company row
      // is created with name only; we can wire an /employer/profile PUT later
      // to fill in the rest.
      setFeedback('Account created. Redirecting…')
      navigate('/employer/dashboard')
    } catch (err) {
      setFeedback(err.message || 'Sign up failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="employer-signup-page" style={themeVars}>
      <header className="es-header">
        <div className="es-wrap">
          <button className="es-brand" type="button" onClick={() => navigate('/')}>
            <span className="es-brand-icon">{EMPLOYER_SIGNUP_CONFIG.brand.glyph}</span>
            <span>{EMPLOYER_SIGNUP_CONFIG.brand.name}</span>
          </button>
        </div>
      </header>

      <main className="es-main">
        <div className="es-wrap">
          <section className="es-card">
            <h1>{EMPLOYER_SIGNUP_CONFIG.title}</h1>
            <p className="es-sub">{EMPLOYER_SIGNUP_CONFIG.subtitle}</p>

            <div className="es-grid">
              {EMPLOYER_SIGNUP_CONFIG.fields.map((f) => (
                <label key={f.id} className="es-field">
                  <span>{f.label}</span>
                  <input
                    name={f.id}
                    type={f.type}
                    value={form[f.id]}
                    onChange={onChange}
                    placeholder={f.placeholder}
                    autoComplete={f.id === 'password' ? 'new-password' : undefined}
                  />
                </label>
              ))}

              <label className="es-field">
                <span>{EMPLOYER_SIGNUP_CONFIG.labels.companySize}</span>
                <select
                  name="companySize"
                  value={form.companySize}
                  onChange={onChange}
                >
                  <option value="">{EMPLOYER_SIGNUP_CONFIG.placeholders.companySize}</option>
                  {EMPLOYER_SIGNUP_CONFIG.companySize.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="es-field es-field-full">
              <span>{EMPLOYER_SIGNUP_CONFIG.labels.companyDescription}</span>
              <textarea
                name="companyDescription"
                value={form.companyDescription}
                onChange={onChange}
                placeholder={EMPLOYER_SIGNUP_CONFIG.placeholders.companyDescription}
                rows={4}
              />
            </label>

            <div className="es-actions">
              <button
                type="button"
                className="es-primary"
                onClick={onSubmit}
                disabled={busy}
              >
                {busy ? 'Creating account…' : EMPLOYER_SIGNUP_CONFIG.actions.submit}
              </button>
            </div>

            <p className="es-feedback" aria-live="polite">{feedback}</p>
          </section>
        </div>
      </main>
    </div>
  )
}

export default EmployerSignupPage
