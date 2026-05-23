import { Navigate, Route, Routes } from 'react-router-dom'
import CandidateDashboardPage from './pages/CandidateDashboardPage'
import CandidateJobDetailsPage from './pages/CandidateJobDetailsPage'
import CandidateJobSearchPage from './pages/CandidateJobSearchPage'
import CandidateMyApplicationsPage from './pages/CandidateMyApplicationsPage'
import CandidateProfilePage from './pages/CandidateProfilePage'
import CandidateSignupPage from './pages/SignupPage'
import EmployerCreateJobPage from './pages/EmployerCreateJobPage'
import EmployerDashboardPage from './pages/EmployerDashboardPage'
import EmployerFindCandidatesPage from './pages/EmployerFindCandidatesPage'
import EmployerSignupPage from './pages/EmployerSignupPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/candidate-signup" element={<CandidateSignupPage />} />
      <Route path="/candidate-signup/candidate" element={<CandidateProfilePage />} />
      <Route path="/candidate/dashboard" element={<CandidateDashboardPage />} />
      <Route path="/candidate/job-search" element={<CandidateJobSearchPage />} />
      <Route path="/candidate/my-applications" element={<CandidateMyApplicationsPage />} />
      <Route path="/candidate/job-details" element={<CandidateJobDetailsPage />} />
      <Route path="/employer-signup" element={<EmployerSignupPage />} />
      <Route path="/employer/dashboard" element={<EmployerDashboardPage />} />
      <Route path="/employer/create-job" element={<EmployerCreateJobPage />} />
      <Route path="/employer/find-candidates" element={<EmployerFindCandidatesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
