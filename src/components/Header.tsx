import { useState } from 'react'
import { useStore } from '../store'
import { useVersionCheck } from '../hooks/useVersionCheck'
import HelpModal from './HelpModal'

export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settings = useStore((s) => s.settings)
  const { hasUpdate, latestRelease, dismiss } = useVersionCheck()
  const [showHelp, setShowHelp] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(120,95,72,0.12)] bg-[rgba(248,243,236,0.88)] backdrop-blur-xl dark:bg-gray-950/80 dark:border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 min-h-16 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(143,106,77,0.14)] bg-[rgba(255,251,246,0.9)] text-[rgb(143,106,77)] shadow-[0_8px_24px_rgba(93,66,43,0.08)]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[11px] uppercase tracking-[0.28em] text-[rgba(120,95,72,0.66)]">Private Image Atelier</div>
            <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-[rgb(54,42,33)] dark:text-gray-100">
              Image Daydream
            </span>
          </h1>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[rgba(110,92,75,0.78)]">
              <span className="rounded-full border border-[rgba(120,95,72,0.12)] bg-[rgba(255,247,239,0.88)] px-2 py-0.5">
                {settings.credentialMode === 'site' ? (settings.providerLine === 'line2' ? '线路 2' : '线路 1') : '我的 API'}
              </span>
              <span className="rounded-full border border-[rgba(120,95,72,0.12)] bg-[rgba(255,247,239,0.88)] px-2 py-0.5">
                {settings.transportMode === 'server' ? '云端代理' : settings.transportMode === 'bridge' ? '本地桥接' : '浏览器直连'}
              </span>
              <span className="rounded-full border border-[rgba(120,95,72,0.12)] bg-[rgba(255,247,239,0.88)] px-2 py-0.5">
                {settings.apiMode === 'responses' ? 'Responses API' : 'Images API'}
              </span>
            </div>
          </div>
          {hasUpdate && latestRelease && (
            <a
              href={latestRelease.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismiss}
              className="px-2 py-1 rounded-full border border-[rgba(184,92,75,0.18)] text-[10px] font-semibold bg-[rgba(184,92,75,0.9)] text-white hover:bg-[rgba(166,82,65,0.95)] transition-colors animate-fade-in leading-none"
              title={`新版本 ${latestRelease.tag}`}
            >
              NEW
            </a>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-xl border border-transparent hover:border-[rgba(120,95,72,0.1)] hover:bg-[rgba(255,247,239,0.9)] dark:hover:bg-gray-900 transition-colors"
            title="操作指南"
          >
            <svg
              className="w-5 h-5 text-[rgba(110,92,75,0.82)] dark:text-gray-400"
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
            className="p-2 rounded-xl border border-transparent hover:border-[rgba(120,95,72,0.1)] hover:bg-[rgba(255,247,239,0.9)] dark:hover:bg-gray-900 transition-colors"
            title="设置"
          >
            <svg
              className="w-5 h-5 text-[rgba(110,92,75,0.82)] dark:text-gray-400"
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
