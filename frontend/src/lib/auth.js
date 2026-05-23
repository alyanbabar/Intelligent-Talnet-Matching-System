// JWT and current-user state, persisted in localStorage so the user stays
// logged in across page refreshes. The token is the only sensitive thing;
// the cached user object is a convenience copy for the UI.

import { api } from './api'

const TOKEN_KEY = 'talentmatch:token'
const USER_KEY = 'talentmatch:user'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isLoggedIn() {
  return !!getToken()
}

export function setAuth({ token, user }) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // localStorage disabled — caller will see the user object isn't persisted
    // but the in-memory app session can still proceed.
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* no-op */
  }
}

export async function login({ email, password }) {
  const resp = await api.post('/auth/login', { email, password }, { auth: false })
  setAuth({ token: resp.access_token, user: resp.user })
  return resp.user
}

export async function register({ full_name, email, password, role, company_name }) {
  // After register, immediately log in so the user goes straight to the dashboard.
  const payload = { full_name, email, password, role }
  if (role === 'employer' && company_name) payload.company_name = company_name
  await api.post('/auth/register', payload, { auth: false })
  return login({ email, password })
}

export function logout() {
  clearAuth()
}
