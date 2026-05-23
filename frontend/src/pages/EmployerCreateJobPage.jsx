import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { isLoggedIn, logout } from '../lib/auth'
import './EmployerCreateJobPage.css'

// Matches Figma node 4:1179 — labels / placeholders kept close to the file.
const CREATE_JOB_CONFIG = {
  brand: { name: 'TalentMatch', glyph: 'T' },
  sidebarItems: [
    { id: 'dashboard', label: 'Dashboard', path: '/employer/dashboard' },
    { id: 'create-job', label: 'Create Job', path: '/employer/create-job' },
    { id: 'find-candidates', label: 'Find Candidates', path: '/employer/find-candidates' },
  ],
  sidebarFooter: { id: 'logout', label: 'Logout' },
  title: 'Create Job Posting',
  subtitle: 'Fill out the details to post a new job opening',
  fields: {
    jobTitle: { label: 'Job Title', placeholder: 'e.g. Senior Frontend Developer' },
    companyName: { label: 'Company Name', placeholder: 'Your company name' },
    jobDescription: {
      label: 'Job Description',
      placeholder:
        'Describe the role, responsibilities, and what makes this opportunity unique...',
    },
    requiredEducation: { label: 'Required Education' },
    educationOptions: [
      { value: '', label: 'Select level' },
      { value: 'High school', label: 'High school' },
      { value: 'Associate degree', label: 'Associate degree' },
      { value: "Bachelor's degree", label: "Bachelor's degree" },
      { value: "Master's degree", label: "Master's degree" },
      { value: 'Doctorate', label: 'Doctorate' },
    ],
    requiredSkills: {
      label: 'Required Skills',
      placeholder: 'e.g. React, TypeScript, Node.js, AWS...',
      hint: 'Separate skills with commas',
    },
    yearsExperience: { label: 'Years of Experience Required' },
    yearOptions: [
      { value: '', label: 'Select range' },
      { value: '0–1 years', label: '0–1 years' },
      { value: '2–3 years', label: '2–3 years' },
      { value: '4–5 years', label: '4–5 years' },
      { value: '6+ years', label: '6+ years' },
    ],
    employmentType: { label: 'Employment type' },
    employmentOptions: [
      { value: 'Full-time', label: 'Full-time' },
      { value: 'Part-time', label: 'Part-time' },
      { value: 'Contract', label: 'Contract' },
    ],
    workMode: { label: 'Work Mode' },
    workModes: [
      { value: 'Remote', label: 'Remote' },
      { value: 'Hybrid', label: 'Hybrid' },
      { value: 'On-site', label: 'On-site' },
    ],
    jobLocation: { label: 'Job Location', placeholder: 'e.g. San Francisco, CA' },
    salaryRange: {
      label: 'Salary range (optional)',
      placeholder: 'e.g. $120k – $140k',
    },
  },
  actions: {
    publish: 'Publish Job',
    saveDraft: 'Save Draft',
    cancel: 'Cancel',
  },
}

const initialForm = {
  jobTitle: '',
  companyName: '',
  jobDescription: '',
  requiredEducation: '',
  requiredSkills: '',
  yearsExperience: '',
  employmentType: 'Full-time',
  workMode: 'Hybrid',
  jobLocation: '',
  salaryRange: '',
}

function EmployerCreateJobPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const themeVars = useMemo(
    () => ({
      '--emp-white': '#FFFFFF',
      '--emp-page-bg': '#F8FAFC',
      '--emp-border': '#E2E8F0',
      '--emp-primary': '#2563EB',
      '--emp-heading': '#1E293B',
      '--emp-body': '#64748B',
    }),
    [],
  )

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login')
    }
  }, [navigate])

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setError('')
  }

  const validate = () => {
    if (!form.jobTitle.trim()) return 'Add a job title.'
    if (!form.companyName.trim()) return 'Add a company name.'
    if (form.jobDescription.trim().length < 20) return 'Job description should be at least a short paragraph.'
    if (!form.requiredEducation) return 'Pick a required education level.'
    if (!form.requiredSkills.trim()) return 'Add at least one skill (comma-separated).'
    if (!form.yearsExperience) return 'Pick years of experience.'
    if (!form.employmentType) return 'Pick employment type.'
    if (!form.workMode) return 'Pick work mode.'
    if (form.workMode !== 'Remote' && !form.jobLocation.trim()) {
      return 'Add a location, or switch work mode to Remote.'
    }
    return ''
  }

  // Map UI labels to backend enum values.
  const TYPE_MAP = {
    'Full-time': 'FULL_TIME',
    'Part-time': 'PART_TIME',
    'Contract': 'CONTRACT',
    'Internship': 'INTERNSHIP',
    'Temporary': 'TEMPORARY',
  }
  const MODE_MAP = {
    'Remote': 'REMOTE',
    'On-site': 'ONSITE',
    'Onsite': 'ONSITE',
    'Hybrid': 'HYBRID',
  }
  const YEARS_TO_LEVEL = {
    '0–1 years': 'ENTRY',
    '2–3 years': 'JUNIOR',
    '4–5 years': 'MID',
    '6+ years': 'SENIOR',
  }

  // Best-effort parse of "$120k – $140k" / "50000-70000" / "AUD 60k" etc.
  const parseSalary = (raw) => {
    if (!raw) return { min: null, max: null }
    const numbers = String(raw)
      .replace(/k/gi, '000')
      .match(/\d+(\.\d+)?/g)
    if (!numbers || numbers.length === 0) return { min: null, max: null }
    const min = Number(numbers[0])
    const max = numbers.length > 1 ? Number(numbers[1]) : null
    return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null }
  }

  const onPublish = async () => {
    const msg = validate()
    if (msg) {
      setError(msg)
      return
    }
    setError('')
    setStatus('Publishing…')
    const { min, max } = parseSalary(form.salaryRange)
    const payload = {
      title: form.jobTitle.trim(),
      description: form.jobDescription.trim(),
      requirements: [
        form.requiredEducation ? `Education: ${form.requiredEducation}` : null,
        form.yearsExperience ? `Experience: ${form.yearsExperience}` : null,
      ].filter(Boolean).join('\n'),
      location: form.workMode === 'Remote' ? 'Remote' : form.jobLocation.trim(),
      working_mode: MODE_MAP[form.workMode] || 'HYBRID',
      job_type: TYPE_MAP[form.employmentType] || 'FULL_TIME',
      experience_level: YEARS_TO_LEVEL[form.yearsExperience] || 'MID',
      salary_min: min,
      salary_max: max,
      required_skills: form.requiredSkills,
    }
    try {
      await api.post('/employer/jobs', payload)
      navigate('/employer/dashboard', {
        state: { employerNotice: 'Job published. Candidates can find it in Job Search.' },
      })
    } catch (e) {
      setError(e.message || 'Could not publish.')
      setStatus('')
    }
  }

  const onSaveDraft = () => {
    // Drafts are not supported by the backend. Keep the button visible but
    // explain why nothing happens.
    setStatus('Drafts are not saved on the server in this build. Use Publish when ready.')
  }

  const goSidebar = (item) => {
    if (item.id === 'logout') {
      logout()
      navigate('/login')
      return
    }
    if (item.path) navigate(item.path)
    else setStatus(`${item.label} — coming soon.`)
  }

  return (
    <div className="employer-page employer-create-job-page" style={themeVars}>
      <aside className="employer-sidebar">
        <div className="employer-brand-wrap">
          <button className="employer-brand" type="button" onClick={() => navigate('/')}>
            <span className="employer-brand-icon">{CREATE_JOB_CONFIG.brand.glyph}</span>
            <span className="employer-brand-text">{CREATE_JOB_CONFIG.brand.name}</span>
          </button>
        </div>
        <nav className="employer-nav">
          {CREATE_JOB_CONFIG.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`employer-nav-item ${item.id === 'create-job' ? 'active' : ''}`}
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
            onClick={() => goSidebar(CREATE_JOB_CONFIG.sidebarFooter)}
          >
            {CREATE_JOB_CONFIG.sidebarFooter.label}
          </button>
        </div>
      </aside>

      <main className="employer-main ecj-main">
        <header className="ecj-header">
          <h1>{CREATE_JOB_CONFIG.title}</h1>
          <p>{CREATE_JOB_CONFIG.subtitle}</p>
        </header>

        <section className="ecj-card">
          <div className="ecj-form">
            <label className="ecj-field">
              <span>{CREATE_JOB_CONFIG.fields.jobTitle.label}</span>
              <input
                name="jobTitle"
                value={form.jobTitle}
                onChange={onChange}
                placeholder={CREATE_JOB_CONFIG.fields.jobTitle.placeholder}
              />
            </label>

            <label className="ecj-field">
              <span>{CREATE_JOB_CONFIG.fields.companyName.label}</span>
              <input
                name="companyName"
                value={form.companyName}
                onChange={onChange}
                placeholder={CREATE_JOB_CONFIG.fields.companyName.placeholder}
              />
            </label>

            <label className="ecj-field">
              <span>{CREATE_JOB_CONFIG.fields.jobDescription.label}</span>
              <textarea
                name="jobDescription"
                value={form.jobDescription}
                onChange={onChange}
                placeholder={CREATE_JOB_CONFIG.fields.jobDescription.placeholder}
                rows={6}
              />
            </label>

            <div className="ecj-row">
              <label className="ecj-field">
                <span>{CREATE_JOB_CONFIG.fields.requiredEducation.label}</span>
                <select name="requiredEducation" value={form.requiredEducation} onChange={onChange}>
                  {CREATE_JOB_CONFIG.fields.educationOptions.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ecj-field">
                <span>{CREATE_JOB_CONFIG.fields.yearsExperience.label}</span>
                <select name="yearsExperience" value={form.yearsExperience} onChange={onChange}>
                  {CREATE_JOB_CONFIG.fields.yearOptions.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="ecj-field">
              <span>{CREATE_JOB_CONFIG.fields.requiredSkills.label}</span>
              <input
                name="requiredSkills"
                value={form.requiredSkills}
                onChange={onChange}
                placeholder={CREATE_JOB_CONFIG.fields.requiredSkills.placeholder}
              />
              <span className="ecj-hint">{CREATE_JOB_CONFIG.fields.requiredSkills.hint}</span>
            </label>

            <label className="ecj-field">
              <span>{CREATE_JOB_CONFIG.fields.employmentType.label}</span>
              <select name="employmentType" value={form.employmentType} onChange={onChange}>
                {CREATE_JOB_CONFIG.fields.employmentOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="ecj-fieldset">
              <legend>{CREATE_JOB_CONFIG.fields.workMode.label}</legend>
              <div className="ecj-radios">
                {CREATE_JOB_CONFIG.fields.workModes.map((m) => (
                  <label key={m.value} className="ecj-radio">
                    <input
                      type="radio"
                      name="workMode"
                      value={m.value}
                      checked={form.workMode === m.value}
                      onChange={onChange}
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="ecj-field">
              <span>{CREATE_JOB_CONFIG.fields.jobLocation.label}</span>
              <input
                name="jobLocation"
                value={form.jobLocation}
                onChange={onChange}
                placeholder={CREATE_JOB_CONFIG.fields.jobLocation.placeholder}
                disabled={form.workMode === 'Remote'}
              />
              {form.workMode === 'Remote' ? (
                <span className="ecj-hint">Remote roles use “Remote” as the location for candidates.</span>
              ) : null}
            </label>

            <label className="ecj-field">
              <span>{CREATE_JOB_CONFIG.fields.salaryRange.label}</span>
              <input
                name="salaryRange"
                value={form.salaryRange}
                onChange={onChange}
                placeholder={CREATE_JOB_CONFIG.fields.salaryRange.placeholder}
              />
            </label>

            {error ? (
              <p className="ecj-error" role="alert">
                {error}
              </p>
            ) : null}
            {status ? (
              <p className="ecj-status" aria-live="polite">
                {status}
              </p>
            ) : null}

            <div className="ecj-actions">
              <button type="button" className="ecj-btn-primary" onClick={onPublish}>
                {CREATE_JOB_CONFIG.actions.publish}
              </button>
              <button type="button" className="ecj-btn-secondary" onClick={onSaveDraft}>
                {CREATE_JOB_CONFIG.actions.saveDraft}
              </button>
              <button type="button" className="ecj-btn-link" onClick={() => navigate('/employer/dashboard')}>
                {CREATE_JOB_CONFIG.actions.cancel}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default EmployerCreateJobPage
