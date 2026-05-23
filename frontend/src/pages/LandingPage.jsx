import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

const LANDING_PAGE_CONFIG = {
  brand: {
    name: 'TalentMatch',
    logoGlyph: 'T',
  },
  navigation: [
    { id: 'home', label: 'Home', kind: 'text' },
    { id: 'how-it-works', label: 'How It Works', kind: 'text' },
    { id: 'log-in', label: 'Log In', kind: 'text' },
    { id: 'sign-up', label: 'Sign Up', kind: 'primary' },
  ],
  hero: {
    title: 'Intelligent Talent Matching Platform',
    description:
      'Connect the right candidates with the right opportunities using AI-powered matching technology',
    actions: [
      { id: 'find-jobs', label: 'Find Jobs', kind: 'primary' },
      { id: 'hire-talent', label: 'Hire Talent', kind: 'outline' },
    ],
    statCard: {
      icon: 'SMT',
      title: 'Smart Matching Technology',
    },
  },
  howItWorks: {
    title: 'How It Works',
    columns: [
      {
        id: 'candidates',
        title: 'For Candidates',
        icon: 'CJ',
        points: [
          'Create your professional profile with education and experience',
          'Browse AI-matched job opportunities tailored to your skills',
          'Apply to positions that match your career goals',
        ],
      },
      {
        id: 'employers',
        title: 'For Employers',
        icon: 'EM',
        points: [
          'Post job openings with detailed requirements',
          'Search through qualified candidates with AI matching scores',
          'Connect with top talent that fits your team',
        ],
      },
    ],
  },
  footer: {
    note: '© 2026 TalentMatch. All rights reserved.',
  },
  theme: {
    colors: {
      pageBg: '#FFFFFF',
      sectionAltBg: '#F8FAFC',
      textHeading: '#1E293B',
      textBody: '#64748B',
      border: '#E2E8F0',
      primary: '#2563EB',
      primaryDarkText: '#1C398E',
      iconBg: '#DBEAFE',
      heroGradientStart: '#EFF6FF',
      heroGradientEnd: '#DBEAFE',
    },
    typography: {
      headingFont: '"Manrope", sans-serif',
      bodyFont: '"DM Sans", sans-serif',
    },
  },
}

function LandingPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('home')
  const [lastAction, setLastAction] = useState('Ready')

  const themeVars = useMemo(
    () => ({
      '--page-bg': LANDING_PAGE_CONFIG.theme.colors.pageBg,
      '--section-alt-bg': LANDING_PAGE_CONFIG.theme.colors.sectionAltBg,
      '--text-heading': LANDING_PAGE_CONFIG.theme.colors.textHeading,
      '--text-body': LANDING_PAGE_CONFIG.theme.colors.textBody,
      '--border-color': LANDING_PAGE_CONFIG.theme.colors.border,
      '--primary-color': LANDING_PAGE_CONFIG.theme.colors.primary,
      '--primary-dark-text': LANDING_PAGE_CONFIG.theme.colors.primaryDarkText,
      '--icon-bg': LANDING_PAGE_CONFIG.theme.colors.iconBg,
      '--hero-gradient': `linear-gradient(135deg, ${LANDING_PAGE_CONFIG.theme.colors.heroGradientStart} 0%, ${LANDING_PAGE_CONFIG.theme.colors.heroGradientEnd} 100%)`,
      '--heading-font': LANDING_PAGE_CONFIG.theme.typography.headingFont,
      '--body-font': LANDING_PAGE_CONFIG.theme.typography.bodyFont,
    }),
    [],
  )

  const handleAction = (actionLabel, nextSection) => {
    if (nextSection === 'sign-up') {
      navigate('/candidate-signup')
      return
    }
    if (nextSection === 'log-in') {
      navigate('/login')
      return
    }
    if (nextSection === 'find-jobs') {
      navigate('/candidate/job-search')
      return
    }
    if (nextSection === 'hire-talent') {
      navigate('/employer-signup')
      return
    }

    setActiveSection(nextSection)
    setLastAction(`${actionLabel} clicked`)
  }

  return (
    <div className="talentmatch-page" style={themeVars}>
      <header className="top-nav">
        <div className="content-wrap nav-inner">
          <button
            className="brand"
            type="button"
            onClick={() => handleAction(LANDING_PAGE_CONFIG.brand.name, 'home')}
          >
            <span className="brand-icon">{LANDING_PAGE_CONFIG.brand.logoGlyph}</span>
            <span className="brand-name">{LANDING_PAGE_CONFIG.brand.name}</span>
          </button>
          <nav className="nav-links" aria-label="Main navigation">
            {LANDING_PAGE_CONFIG.navigation.map((item) => (
              <button
                key={item.id}
                className={`nav-link nav-link-${item.kind} ${activeSection === item.id ? 'is-active' : ''}`}
                type="button"
                onClick={() => handleAction(item.label, item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="content-wrap hero-grid">
            <div className="hero-copy">
              <h1>{LANDING_PAGE_CONFIG.hero.title}</h1>
              <p>{LANDING_PAGE_CONFIG.hero.description}</p>
              <div className="hero-actions">
                {LANDING_PAGE_CONFIG.hero.actions.map((action) => (
                  <button
                    key={action.id}
                    className={`action-btn action-btn-${action.kind}`}
                    type="button"
                    onClick={() => handleAction(action.label, action.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hero-visual-card">
              <div className="ai-badge">{LANDING_PAGE_CONFIG.hero.statCard.icon}</div>
              <p>{LANDING_PAGE_CONFIG.hero.statCard.title}</p>
            </div>
          </div>
        </section>

        <section className="how-section">
          <div className="content-wrap">
            <h2>{LANDING_PAGE_CONFIG.howItWorks.title}</h2>
            <div className="info-cards">
              {LANDING_PAGE_CONFIG.howItWorks.columns.map((column) => (
                <article key={column.id} className="info-card">
                  <div className="card-icon">{column.icon}</div>
                  <h3>{column.title}</h3>
                  <ul>
                    {column.points.map((point) => (
                      <li key={point}>
                        <span className="bullet-check" aria-hidden="true">
                          ✓
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="page-footer">
        <div className="content-wrap footer-inner">
          <p>{LANDING_PAGE_CONFIG.footer.note}</p>
        </div>
        <div className="content-wrap action-feedback" aria-live="polite">
          {lastAction}
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
