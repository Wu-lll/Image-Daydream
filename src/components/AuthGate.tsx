import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

type AuthState = 'checking' | 'authenticated' | 'locked'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(import.meta.env.DEV ? 'authenticated' : 'checking')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return

    fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      .then((response) => {
        setState(response.ok ? 'authenticated' : 'locked')
      })
      .catch(() => setState('locked'))
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const code = accessCode.trim()
    if (!code) {
      setError('请输入访问口令')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ accessCode: code }),
      })

      if (!response.ok) {
        setError('访问口令不正确')
        return
      }

      setState('authenticated')
      setAccessCode('')
    } catch {
      setError('网络连接失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'authenticated') return <>{children}</>

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(231,210,187,0.5),transparent_28%),linear-gradient(135deg,#f8f0e6_0%,#fffaf4_46%,#eee0d0_100%)] text-[rgb(54,42,33)]">
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(88,65,46,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(88,65,46,0.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-[2rem] border border-[rgba(120,95,72,0.16)] bg-[rgba(255,251,246,0.88)] p-7 shadow-[0_28px_90px_rgba(93,66,43,0.18)] backdrop-blur-xl"
        >
          <div className="mb-8">
            <div className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[rgba(120,95,72,0.64)]">
              Private Image Atelier
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">Image Daydream</h1>
            <p className="mt-3 text-sm leading-6 text-[rgba(82,61,46,0.72)]">
              请输入访问口令，进入 Image Daydream。
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs text-[rgba(82,61,46,0.72)]">访问口令</span>
            <input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              type="password"
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-2xl border border-[rgba(120,95,72,0.16)] bg-[rgba(255,252,247,0.92)] px-4 py-3 text-sm outline-none transition focus:border-[rgba(143,106,77,0.48)] focus:shadow-[0_0_0_4px_rgba(143,106,77,0.08)]"
              placeholder="输入口令"
            />
          </label>

          {error && <div className="mt-3 text-sm text-[rgb(166,82,65)]">{error}</div>}

          <button
            type="submit"
            disabled={submitting || state === 'checking'}
            className="mt-6 w-full rounded-2xl bg-[rgb(82,61,46)] px-4 py-3 text-sm font-medium text-white shadow-[0_12px_30px_rgba(82,61,46,0.18)] transition hover:bg-[rgb(109,80,59)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === 'checking' ? '正在检查访问状态...' : submitting ? '正在进入...' : '进入'}
          </button>

          <p className="mt-5 text-center text-[11px] leading-5 text-[rgba(124,109,97,0.7)]">
            36 小时未使用后，需要重新输入口令。
          </p>
        </form>
      </section>
    </main>
  )
}
