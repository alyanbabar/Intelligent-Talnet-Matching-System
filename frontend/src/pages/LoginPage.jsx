import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/auth'
import './LoginPage.css'

const LOGIN_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  title: 'Log in to TalentMatch',
  subtitle: 'Welcome back. Enter your details to continue.',
  fields: [
    { id: 'email', label: 'Email', placeholder: 'you@example.com', type: 'email' },
    { id: 'password', label: 'Password', placeholder: 'Your password', type: 'password' },
  ],
  submit: 'Log In',
  noAccount: { prefix: "Don't have an account?", actionText: 'Sign up' },
}

const initialForm = { email: '', password: '' }

function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const themeVars = useMemo(
    () => ({
      '--login-bg': 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)',
      '--login-surface': '#FFFFFF',
      '--login-heading': '#1E293B',
      '--login-body': '#64748B',
      '--login-border': '#E2E8F0',
      '--login-primary': '#2563EB',
    }),
    [],
  )

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setFeedback('Please enter your email and password.')
      return
    }
    setBusy(true)
    setFeedback('Logging in…')
    try {
      const user = await login({ email: form.email.trim(), password: form.password })
      setFeedback('Logged in. Redirecting…')
      // Route to the appropriate dashboard for the role the server returned.
      if (user.role === 'candidate') navigate('/candidate/dashboard')
      else if (user.role === 'employer') navigate('/employer/dashboard')
      else navigate('/')
    } catch (err) {
      setFeedback(err.message || 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page" style={themeVars}>
      <header className="login-nav">
        <div className="login-wrap">
          <button className="login-brand" type="button" onClick={() => navigate('/')}>
            <span className="login-brand-icon">{LOGIN_CONFIG.brand.glyph}</span>
            <span className="login-brand-name">{LOGIN_CONFIG.brand.name}</span>
          </button>
        </div>
      </header>

      <main className="login-main">
        <form className="login-card" onSubmit={onSubmit}>
          <h1>{LOGIN_CONFIG.title}</h1>
          <p className="login-sub">{LOGIN_CONFIG.subtitle}</p>

          {LOGIN_CONFIG.fields.map((f) => (
            <label key={f.id} className="login-field">
              <span>{f.label}</span>
              <input
                name={f.id}
                type={f.type}
                value={form[f.id]}
                onChange={onChange}
                placeholder={f.placeholder}
                autoComplete={f.id === 'password' ? 'current-password' : 'email'}
              />
            </label>
          ))}

          <button type="submit" className="login-primary" disabled={busy}>
            {busy ? 'Logging in…' : LOGIN_CONFIG.submit}
          </button>

          <p className="login-feedback" aria-live="polite">{feedback}</p>

          <p className="login-signup-line">
            {LOGIN_CONFIG.noAccount.prefix}{' '}
            <button type="button" onClick={() => navigate('/candidate-signup')}>
              {LOGIN_CONFIG.noAccount.actionText}
            </button>
          </p>
        </form>
      </main>
    </div>
  )
}

export default LoginPage
