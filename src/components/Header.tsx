import { useState } from 'react'
import { useStore } from '../store'
import HelpModal from './HelpModal'

export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settings = useStore((s) => s.settings)
  const [showHelp, setShowHelp] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(63,86,110,0.12)] bg-[rgba(245,248,251,0.88)] backdrop-blur-xl dark:bg-gray-950/80 dark:border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 min-h-16 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(29,39,49,0.16)] bg-[rgb(29,39,49)] text-white shadow-[0_10px_26px_rgba(42,59,77,0.14)]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 20c4.5-1.2 8.2-4.1 11-8.8l2.8-4.8a1.8 1.8 0 0 1 2.5-.6 1.8 1.8 0 0 1 .6 2.5l-2.8 4.8C15.3 17.8 10.6 20.1 4 20z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13.5 7.8l2.8 1.6" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="[font-family:var(--font-serif-display)] text-[1.65rem] leading-none font-medium tracking-normal">
            <span className="text-[rgb(29,39,49)] dark:text-gray-100">
              Image Daydream
            </span>
          </h1>
            <div className="text-[11px] text-[rgba(102,118,136,0.72)]">为灵感留一张安静的纸</div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[rgba(102,118,136,0.78)]">
              <span className="rounded-full border border-[rgba(63,86,110,0.12)] bg-[rgba(248,251,255,0.88)] px-2 py-0.5">
                {settings.credentialMode === 'site' ? (settings.providerLine === 'line2' ? '线路 2' : '线路 1') : '自定义 API'}
              </span>
              <span className="rounded-full border border-[rgba(63,86,110,0.12)] bg-[rgba(248,251,255,0.88)] px-2 py-0.5">
                {settings.transportMode === 'server' ? '云端代理' : settings.transportMode === 'bridge' ? '本地桥接' : '浏览器直连'}
              </span>
              <span className="rounded-full border border-[rgba(63,86,110,0.12)] bg-[rgba(248,251,255,0.88)] px-2 py-0.5">
                {settings.apiMode === 'responses' ? '响应接口' : '图片接口'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-xl border border-transparent hover:border-[rgba(63,86,110,0.12)] hover:bg-[rgba(248,251,255,0.9)] dark:hover:bg-gray-900 transition-colors"
            title="操作指南"
          >
            <svg
              className="w-5 h-5 text-[rgba(102,118,136,0.86)] dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl border border-transparent hover:border-[rgba(63,86,110,0.12)] hover:bg-[rgba(248,251,255,0.9)] dark:hover:bg-gray-900 transition-colors"
            title="设置"
          >
            <svg
              className="w-5 h-5 text-[rgba(102,118,136,0.86)] dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </header>
  )
}
