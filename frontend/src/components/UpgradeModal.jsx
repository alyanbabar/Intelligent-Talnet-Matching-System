import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getUser, setAuth, getToken } from '../lib/auth'
import './UpgradeModal.css'

// A simulated payment modal. The card number / CVV / expiry are NOT sent
// to a real payment processor — the backend just validates the shape and
// flips the user to PREMIUM.

const PRICE = 'AUD 9.99'
const FEATURES = [
  'Unlimited recommendations (no Top 10 cap)',
  'Priority placement in employer searches',
  'Advanced filters and sorting',
  'Membership history visible to admins',
]

function UpgradeModal({ open, onClose, onSuccess, roleEndpoint = '/candidate/upgrade' }) {
  const [step, setStep] = useState('form')   // 'form' | 'success'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name_on_card: '',
    card_number: '',
    expiry: '',
    cvv: '',
    billing_email: '',
  })
  const [receipt, setReceipt] = useState(null)

  // Reset when the modal opens.
  useEffect(() => {
    if (open) {
      setStep('form')
      setBusy(false)
      setError('')
      setReceipt(null)
      const u = getUser()
      setForm({
        name_on_card: u?.full_name || '',
        card_number: '',
        expiry: '',
        cvv: '',
        billing_email: u?.email || '',
      })
    }
  }, [open])

  // Esc closes the modal (form step only — once payment goes through
  // the user clicks Done explicitly).
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && step === 'form' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, busy, onClose])

  const themeVars = useMemo(
    () => ({
      '--um-primary': '#2563EB',
      '--um-heading': '#1E293B',
      '--um-body': '#64748B',
      '--um-border': '#E2E8F0',
    }),
    [],
  )

  if (!open) return null

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setError('')
  }

  // Light formatting: keep digits in groups of 4 for readability.
  const formatCardNumber = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 19)
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const formatExpiry = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const resp = await api.post(roleEndpoint, {
        name_on_card: form.name_on_card,
        card_number: form.card_number,
        expiry: form.expiry,
        cvv: form.cvv,
        billing_email: form.billing_email,
      })
      // Refresh the cached user so the dashboard pill flips to Member.
      const token = getToken()
      const u = getUser()
      if (token && u) {
        setAuth({ token, user: { ...u, is_member: true } })
      }
      setReceipt(resp.payment || null)
      setStep('success')
      if (onSuccess) onSuccess(resp)
    } catch (err) {
      setError(err.message || 'Payment failed. Please check your details.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="um-root"
      role="presentation"
      style={themeVars}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && step === 'form' && !busy) onClose()
      }}
    >
      <div className="um-card" role="dialog" aria-modal="true" aria-labelledby="um-title">
        {step === 'form' ? (
          <>
            <header className="um-head">
              <h2 id="um-title">Upgrade to Premium</h2>
              <p className="um-sub">One payment, ongoing benefits. {PRICE} (simulated).</p>
            </header>

            <ul className="um-features">
              {FEATURES.map((f) => (
                <li key={f}><span aria-hidden="true">✓</span> {f}</li>
              ))}
            </ul>

            <div className="um-form">
              <label className="um-field">
                <span>Name on card</span>
                <input
                  name="name_on_card"
                  value={form.name_on_card}
                  onChange={onChange}
                  placeholder="Jane Doe"
                  autoComplete="cc-name"
                />
              </label>

              <label className="um-field">
                <span>Card number</span>
                <input
                  name="card_number"
                  value={form.card_number}
                  onChange={(e) => setForm((p) => ({ ...p, card_number: formatCardNumber(e.target.value) }))}
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                  autoComplete="cc-number"
                />
              </label>

              <div className="um-row">
                <label className="um-field">
                  <span>Expiry (MM/YY)</span>
                  <input
                    name="expiry"
                    value={form.expiry}
                    onChange={(e) => setForm((p) => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                    placeholder="12/29"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                  />
                </label>
                <label className="um-field">
                  <span>CVV</span>
                  <input
                    name="cvv"
                    value={form.cvv}
                    onChange={(e) => setForm((p) => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="123"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                  />
                </label>
              </div>

              <label className="um-field">
                <span>Billing email</span>
                <input
                  name="billing_email"
                  type="email"
                  value={form.billing_email}
                  onChange={onChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
            </div>

            <p className="um-disclaimer">
              This is a simulated payment for coursework. No real card is charged.
              Try card <code>4242 4242 4242 4242</code>, any future expiry, any 3-digit CVV.
            </p>

            {error ? <p className="um-error" role="alert">{error}</p> : null}

            <div className="um-actions">
              <button type="button" className="um-cancel" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="um-pay" onClick={submit} disabled={busy}>
                {busy ? 'Processing…' : `Pay ${PRICE}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="um-head">
              <h2 id="um-title">Welcome to Premium</h2>
              <p className="um-sub">Your membership is now active.</p>
            </header>

            <div className="um-receipt">
              {receipt ? (
                <>
                  <p><strong>Transaction:</strong> {receipt.transaction_id}</p>
                  <p><strong>Amount:</strong> {receipt.currency} {receipt.amount}</p>
                  <p><strong>Status:</strong> {receipt.status}</p>
                </>
              ) : (
                <p>Receipt unavailable.</p>
              )}
            </div>

            <div className="um-actions um-actions-single">
              <button type="button" className="um-pay" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default UpgradeModal
