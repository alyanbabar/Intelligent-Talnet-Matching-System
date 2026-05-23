import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './SignupPage.css'

const SIGNUP_PAGE_CONFIG = {
  brand: {
    name: 'TalentMatch',
    logoGlyph: 'T',
  },
  header: {
    title: 'Join as a Candidate or Employer',
    subtitle: 'Choose your role to get started',
  },
  roles: [
    {
      id: 'candidate',
      title: 'Candidate',
      icon: 'C',
      description:
        "I'm looking for job opportunities and want to showcase my skills and experience",
      cta: 'Join as Candidate',
    },
    {
      id: 'employer',
      title: 'Employer',
      icon: 'E',
      description:
        "I'm hiring and want to find qualified candidates for my company",
      cta: 'Join as Employer',
    },
  ],
  accountPrompt: {
    prefix: 'Already have an account?',
    actionText: 'Log in',
  },
  theme: {
    colors: {
      bgStart: '#EFF6FF',
      bgEnd: '#FFFFFF',
      surface: '#FFFFFF',
      heading: '#1E293B',
      body: '#64748B',
      border: '#E2E8F0',
      primary: '#2563EB',
      iconBg: '#DBEAFE',
    },
    typography: {
      headingFont: '"Manrope", sans-serif',
      bodyFont: '"DM Sans", sans-serif',
    },
  },
}

function CandidateSignupPage() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('')
  const [message, setMessage] = useState('Select your role to continue')

  const themeVars = useMemo(
    () => ({
      '--signup-bg': `linear-gradient(135deg, ${SIGNUP_PAGE_CONFIG.theme.colors.bgStart} 0%, ${SIGNUP_PAGE_CONFIG.theme.colors.bgEnd} 100%)`,
      '--signup-surface': SIGNUP_PAGE_CONFIG.theme.colors.surface,
      '--signup-heading': SIGNUP_PAGE_CONFIG.theme.colors.heading,
      '--signup-body': SIGNUP_PAGE_CONFIG.theme.colors.body,
      '--signup-border': SIGNUP_PAGE_CONFIG.theme.colors.border,
      '--signup-primary': SIGNUP_PAGE_CONFIG.theme.colors.primary,
      '--signup-icon-bg': SIGNUP_PAGE_CONFIG.theme.colors.iconBg,
      '--signup-heading-font': SIGNUP_PAGE_CONFIG.theme.typography.headingFont,
      '--signup-body-font': SIGNUP_PAGE_CONFIG.theme.typography.bodyFont,
    }),
    [],
  )

  const handleRoleSelect = (role) => {
    setSelectedRole(role.id)
    setMessage(`${role.title} flow selected`)
    if (role.id === 'candidate') {
      navigate('/candidate-signup/candidate')
      return
    }
    if (role.id === 'employer') {
      navigate('/employer-signup')
    }
  }

  return (
    <div className="signup-page" style={themeVars}>
      <header className="signup-nav">
        <div className="signup-wrap">
          <button className="signup-brand" type="button" onClick={() => navigate('/')}>
            <span className="signup-brand-icon">{SIGNUP_PAGE_CONFIG.brand.logoGlyph}</span>
            <span className="signup-brand-name">{SIGNUP_PAGE_CONFIG.brand.name}</span>
          </button>
        </div>
      </header>

      <main className="signup-main">
        <div className="signup-wrap signup-content">
          <section className="signup-heading">
            <h1>{SIGNUP_PAGE_CONFIG.header.title}</h1>
            <p>{SIGNUP_PAGE_CONFIG.header.subtitle}</p>
          </section>

          <section className="role-grid">
            {SIGNUP_PAGE_CONFIG.roles.map((role) => (
              <article
                key={role.id}
                className={`role-card ${selectedRole === role.id ? 'is-selected' : ''}`}
              >
                <div className="role-card-inner">
                  <div className="role-icon">{role.icon}</div>
                  <h2>{role.title}</h2>
                  <p>{role.description}</p>
                  <button type="button" onClick={() => handleRoleSelect(role)}>
                    {role.cta}
                  </button>
                </div>
              </article>
            ))}
          </section>

          <p className="signup-login-line">
            {SIGNUP_PAGE_CONFIG.accountPrompt.prefix}{' '}
            <button type="button" onClick={() => navigate('/login')}>
              {SIGNUP_PAGE_CONFIG.accountPrompt.actionText}
            </button>
          </p>
          <p className="signup-feedback" aria-live="polite">
            {message}
          </p>
        </div>
      </main>
    </div>
  )
}

export default CandidateSignupPage
