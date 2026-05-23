// Keeps onboarding + applications in localStorage for now. Swap these calls for real API routes when the backend is ready.
//
// Keys we use (also mirrored to /data/*.json while `npm run dev` is running — see vite.config.js):
//   talentmatch:candidate-profile-draft  → candidate-profile-draft.json
//   talentmatch:candidate-profile        → candidate-profile.json
//   talentmatch:employer-profile-draft   → employer-profile-draft.json
//   talentmatch:employer-profile          → employer-profile.json
//   talentmatch:job-applications         → job-applications.json (array)
//   talentmatch:employer-posted-jobs      → employer-posted-jobs.json (array)
//   talentmatch:employer-create-job-draft → employer-create-job-draft.json (form draft)
//   talentmatch:employer-candidate-shortlist → JSON array of candidate ids (shortlist)

export const JOBS_UPDATED_EVENT = 'talentmatch:jobs-updated'

const DEV_DATA_FILES = new Set([
  'candidate-profile-draft.json',
  'candidate-profile.json',
  'employer-profile-draft.json',
  'employer-profile.json',
  'job-applications.json',
  'employer-posted-jobs.json',
  'employer-create-job-draft.json',
])

export const STORAGE_KEYS = {
  candidateDraft: 'talentmatch:candidate-profile-draft',
  candidateProfile: 'talentmatch:candidate-profile',
  employerDraft: 'talentmatch:employer-profile-draft',
  employerProfile: 'talentmatch:employer-profile',
  jobApplications: 'talentmatch:job-applications',
  employerCandidateShortlist: 'talentmatch:employer-candidate-shortlist',
  employerPostedJobs: 'talentmatch:employer-posted-jobs',
  employerCreateJobDraft: 'talentmatch:employer-create-job-draft',
}

function notifyJobsUpdated() {
  window.dispatchEvent(new CustomEvent(JOBS_UPDATED_EVENT))
}

function withSavedMeta(payload) {
  return {
    ...payload,
    savedAt: new Date().toISOString(),
    client: 'talentmatch-ui',
  }
}

// Dev-only: tells Vite to drop a copy into the repo's /data folder so people can open the JSON in the editor.
async function mirrorToDataFolder(fileName, data) {
  if (!import.meta.env.DEV) return
  if (!DEV_DATA_FILES.has(fileName)) {
    console.warn('[talentmatchStorage] skipped unknown file:', fileName)
    return
  }
  try {
    const res = await fetch('/__talentmatch/write-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileName, data }),
    })
    if (!res.ok) console.warn('[talentmatchStorage] mirror failed:', await res.text())
  } catch (err) {
    console.warn('[talentmatchStorage] mirror skipped', err)
  }
}

function saveRaw(key, jsonString) {
  try {
    localStorage.setItem(key, jsonString)
  } catch {
    throw new Error('Could not save locally. Check browser storage permissions.')
  }
}

export function loadJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function saveCandidateDraft(formFields) {
  const payload = withSavedMeta({ ...formFields, status: 'draft' })
  saveRaw(STORAGE_KEYS.candidateDraft, JSON.stringify(payload, null, 2))
  await mirrorToDataFolder('candidate-profile-draft.json', payload)
  return payload
}

export async function saveCandidateProfileComplete(formFields) {
  const payload = withSavedMeta({ ...formFields, status: 'complete' })
  saveRaw(STORAGE_KEYS.candidateProfile, JSON.stringify(payload, null, 2))
  await mirrorToDataFolder('candidate-profile.json', payload)
  return payload
}

export async function saveEmployerDraft(formFields) {
  const payload = withSavedMeta({ ...formFields, status: 'draft' })
  saveRaw(STORAGE_KEYS.employerDraft, JSON.stringify(payload, null, 2))
  await mirrorToDataFolder('employer-profile-draft.json', payload)
  return payload
}

export async function saveEmployerProfileComplete(formFields) {
  const payload = withSavedMeta({ ...formFields, status: 'complete' })
  saveRaw(STORAGE_KEYS.employerProfile, JSON.stringify(payload, null, 2))
  await mirrorToDataFolder('employer-profile.json', payload)
  return payload
}

export function getEmployerCandidateShortlistIds() {
  const list = loadJson(STORAGE_KEYS.employerCandidateShortlist)
  return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []
}

export function setEmployerCandidateShortlistIds(ids) {
  saveRaw(STORAGE_KEYS.employerCandidateShortlist, JSON.stringify(ids))
}

export function toggleEmployerCandidateShortlist(candidateId) {
  const prev = getEmployerCandidateShortlistIds()
  const next = prev.includes(candidateId)
    ? prev.filter((id) => id !== candidateId)
    : [...prev, candidateId]
  setEmployerCandidateShortlistIds(next)
  return { next, added: !prev.includes(candidateId) }
}

export function getJobApplications() {
  const list = loadJson(STORAGE_KEYS.jobApplications)
  return Array.isArray(list) ? list : []
}

export async function addJobApplication(application) {
  const next = [
    ...getJobApplications(),
    withSavedMeta({
      ...application,
      id: `app-${Date.now()}`,
      status: 'Applied',
    }),
  ]
  saveRaw(STORAGE_KEYS.jobApplications, JSON.stringify(next, null, 2))
  await mirrorToDataFolder('job-applications.json', next)
  return next
}

export function getPostedJobs() {
  const list = loadJson(STORAGE_KEYS.employerPostedJobs)
  return Array.isArray(list) ? list : []
}

// Turns the create-job form into the same shape as SAMPLE_JOBS (+ extra fields for job details).
export function buildJobRecordFromForm(form) {
  const tags = String(form.requiredSkills ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 16)
  const workMode = form.workMode || 'Hybrid'
  const location =
    workMode === 'Remote' ? 'Remote' : String(form.jobLocation ?? '').trim() || 'Location TBD'
  return withSavedMeta({
    id: `posted-${Date.now()}`,
    title: String(form.jobTitle ?? '').trim(),
    company: String(form.companyName ?? '').trim(),
    location,
    type: form.employmentType || 'Full-time',
    salary: String(form.salaryRange ?? '').trim() || 'Salary not listed',
    posted: 'Just now',
    tags: tags.length ? tags : ['Open role'],
    match: Math.min(96, 82 + Math.min(14, tags.length * 2)),
    description: String(form.jobDescription ?? '').trim(),
    educationRequirement: form.requiredEducation || '',
    experienceYears: form.yearsExperience || '',
    workMode,
    employerPosted: true,
  })
}

export async function publishEmployerJob(form) {
  const job = buildJobRecordFromForm(form)
  const next = [job, ...getPostedJobs()]
  saveRaw(STORAGE_KEYS.employerPostedJobs, JSON.stringify(next, null, 2))
  await mirrorToDataFolder('employer-posted-jobs.json', next)
  localStorage.removeItem(STORAGE_KEYS.employerCreateJobDraft)
  notifyJobsUpdated()
  return job
}

export async function saveCreateJobDraft(form) {
  const payload = withSavedMeta({ ...form, status: 'draft' })
  saveRaw(STORAGE_KEYS.employerCreateJobDraft, JSON.stringify(payload, null, 2))
  await mirrorToDataFolder('employer-create-job-draft.json', payload)
  return payload
}

export function loadCreateJobDraft() {
  return loadJson(STORAGE_KEYS.employerCreateJobDraft)
}
