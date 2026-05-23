import { SAMPLE_JOBS } from './jobs'
import { getPostedJobs } from '../lib/talentmatchStorage'

// Employer-published listings first, then the built-in sample roles (dashboard + job search read this).
export function getAllJobs() {
  const posted = getPostedJobs()
  return [...posted, ...SAMPLE_JOBS]
}
