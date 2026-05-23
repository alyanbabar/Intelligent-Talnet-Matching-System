import { useEffect, useState } from 'react'
import { JOBS_UPDATED_EVENT, STORAGE_KEYS } from '../lib/talentmatchStorage'

// Bumps when someone publishes a job (same tab) or in another tab via localStorage.
export function useJobsRevision() {
  const [rev, setRev] = useState(0)
  useEffect(() => {
    const bump = () => setRev((n) => n + 1)
    window.addEventListener(JOBS_UPDATED_EVENT, bump)
    const onStorage = (e) => {
      if (e.key === STORAGE_KEYS.employerPostedJobs) bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(JOBS_UPDATED_EVENT, bump)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return rev
}
