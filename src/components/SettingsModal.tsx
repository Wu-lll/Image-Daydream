import { useEffect, useRef, useState, useCallback, type ChangeEvent } from 'react'
import { normalizeBaseUrl } from '../lib/api'
import { useStore, exportData, importData, clearAllData } from '../store'
import { DEFAULT_BRIDGE_URL, DEFAULT_IMAGES_MODEL, DEFAULT_RESPONSES_MODEL, DEFAULT_SETTINGS, type AppSettings } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import Select from './Select'

export default function SettingsModal() {
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [timeoutInput, setTimeoutInput] = useState(String(settings.timeout))
  const [showApiKey, setShowApiKey] = useState(false)

  const getDefaultModelForMode = (apiMode: AppSettings['apiMode']) =>
    apiMode === 'responses' ? DEFAULT_RESPONSES_MODEL : DEFAULT_IMAGES_MODEL

  useEffect(() => {
    if (showSettings) {
      setDraft(settings)
      setTimeoutInput(String(settings.timeout))
    }
  }, [showSettings, settings])

  const commitSettings = (nextDraft: AppSettings) => {
    const apiMode = nextDraft.apiMode === 'responses' ? 'responses' : 'images'
    const defaultModel = getDefaultModelForMode(apiMode)
    const credentialMode = nextDraft.credentialMode === 'custom' ? 'custom' : 'site'
    const transportMode =
      nextDraft.transportMode === 'direct' || nextDraft.transportMode === 'bridge'
        ? nextDraft.transportMode
        : 'server'
    const normalizedDraft: AppSettings = {
      ...nextDraft,
      credentialMode,
      transportMode,
      providerLine: nextDraft.providerLine === 'line2' ? 'line2' : 'line1',
      apiMode,
      baseUrl: normalizeBaseUrl(nextDraft.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl),
      bridgeUrl: normalizeBaseUrl(nextDraft.bridgeUrl.trim() || DEFAULT_BRIDGE_URL),
      apiKey: nextDraft.apiKey,
      model: nextDraft.model.trim() || defaultModel,
      timeout: Number(nextDraft.timeout) || DEFAULT_SETTINGS.timeout,
      rememberCustomKey: Boolean(nextDraft.rememberCustomKey),
    }
    setDraft(normalizedDraft)
    setSettings(normalizedDraft)
  }

  const handleClose = () => {
    const nextTimeout = Number(timeoutInput)
    commitSettings({
      ...draft,
      timeout:
        timeoutInput.trim() === '' || Number.isNaN(nextTimeout)
          ? DEFAULT_SETTINGS.timeout
          : nextTimeout,
    })
    setShowSettings(false)
  }

  const commitTimeout = useCallback(() => {
    const nextTimeout = Number(timeoutInput)
    const normalizedTimeout =
      timeoutInput.trim() === '' ? DEFAULT_SETTINGS.timeout : Number.isNaN(nextTimeout) ? draft.timeout : nextTimeout
    setTimeoutInput(String(normalizedTimeout))
    commitSettings({ ...draft, timeout: normalizedTimeout })
  }, [draft, timeoutInput])

  useCloseOnEscape(showSettings, handleClose)

  if (!showSettings) return null

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) importData(file)
    e.target.value = ''
  }

  const sectionTitleClass = 'mb-3 text-sm font-medium text-[rgb(54,42,33)] dark:text-gray-200'
  const inputClass = 'w-full rounded-2xl border border-[rgba(120,95,72,0.14)] bg-[rgba(255,252,247,0.84)] px-3 py-2.5 text-sm text-[rgb(54,42,33)] outline-none transition focus:border-[rgba(143,106,77,0.45)] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200'
  const hintClass = 'mt-1 text-[11px] leading-5 text-[rgba(124,109,97,0.88)] dark:text-gray-500'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[2rem] border border-[rgba(120,95,72,0.16)] bg-[rgba(255,251,246,0.96)] p-6 shadow-[0_28px_80px_rgba(66,42,24,0.18)] ring-1 ring-[rgba(82,61,46,0.05)] animate-modal-in custom-scrollbar dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.28em] text-[rgba(120,95,72,0.66)]">Image Daydream</div>
            <h3 className="text-lg font-semibold text-[rgb(54,42,33)] dark:text-gray-100">设置</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[rgba(120,95,72,0.16)] bg-[rgba(255,247,239,0.9)] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[rgba(120,95,72,0.72)] dark:text-gray-500 font-mono select-none">v{__APP_VERSION__}</span>
            <button
              onClick={handleClose}
              className="rounded-full p-1 text-[rgba(124,109,97,0.72)] transition hover:bg-[rgba(143,106,77,0.08)] hover:text-[rgb(54,42,33)] dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              aria-label="关闭"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h4 className={sectionTitleClass}>线路选择</h4>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[rgba(120,95,72,0.14)] bg-[rgba(255,252,247,0.68)] p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
              {[
                { label: '使用默认线路', value: 'site' as const },
                { label: '使用我的 API', value: 'custom' as const },
              ].map((option) => {
                const active = draft.credentialMode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const nextDraft = {
                        ...draft,
                        credentialMode: option.value,
                        transportMode: option.value === 'site' ? 'server' as const : draft.transportMode,
                      }
                      setDraft(nextDraft)
                      commitSettings(nextDraft)
                    }}
                    className={`rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-[rgb(143,106,77)] text-white shadow-sm'
                        : 'text-[rgba(82,61,46,0.82)] hover:bg-[rgba(143,106,77,0.08)] dark:text-gray-300 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className={hintClass}>默认线路使用站主额度，真实 Key 只保存在服务端；自己的 API 只在你当前浏览器中使用。</p>
          </section>

          {draft.credentialMode === 'site' ? (
            <section className="pt-5 border-t border-[rgba(120,95,72,0.12)] dark:border-white/[0.08]">
              <h4 className={sectionTitleClass}>默认线路</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '线路 1', value: 'line1' as const, desc: '推荐' },
                  { label: '线路 2', value: 'line2' as const, desc: '备用' },
                ].map((line) => {
                  const active = draft.providerLine === line.value
                  return (
                    <button
                      key={line.value}
                      type="button"
                      onClick={() => {
                        const nextDraft = { ...draft, providerLine: line.value, transportMode: 'server' as const }
                        setDraft(nextDraft)
                        commitSettings(nextDraft)
                      }}
                      className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        active
                          ? 'border-[rgba(143,106,77,0.42)] bg-[rgba(143,106,77,0.1)] text-[rgb(82,61,46)] shadow-sm'
                          : 'border-[rgba(120,95,72,0.14)] bg-[rgba(255,252,247,0.72)] text-[rgba(82,61,46,0.78)] hover:bg-[rgba(143,106,77,0.06)] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300'
                      }`}
                    >
                      <span className="block font-medium">{line.label}</span>
                      <span className="mt-1 block text-[11px] text-[rgba(124,109,97,0.72)]">{line.desc}</span>
                    </button>
                  )
                })}
              </div>
              <p className={hintClass}>页面只显示线路编号，具体服务商、Base URL 和 Key 由 Render 环境变量控制。</p>
            </section>
          ) : (
            <section className="pt-5 border-t border-[rgba(120,95,72,0.12)] dark:border-white/[0.08]">
              <h4 className={sectionTitleClass}>我的 API</h4>
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-xs text-[rgba(110,92,75,0.82)] dark:text-gray-400 mb-1">Base URL</span>
                  <input
                    value={draft.baseUrl}
                    onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    onBlur={(e) => commitSettings({ ...draft, baseUrl: e.target.value })}
                    type="text"
                    placeholder="https://example.com/v1"
                    className={inputClass}
                  />
                </label>

                <div className="block">
                  <span className="block text-xs text-[rgba(110,92,75,0.82)] dark:text-gray-400 mb-1">API Key</span>
                  <div className="relative">
                    <input
                      value={draft.apiKey}
                      onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                      onBlur={(e) => commitSettings({ ...draft, apiKey: e.target.value })}
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="sk-..."
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[rgba(124,109,97,0.72)] hover:text-[rgb(54,42,33)] transition-colors"
                      tabIndex={-1}
                    >
                      {showApiKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>

                <label className="block">
                  <span className="block text-xs text-[rgba(110,92,75,0.82)] dark:text-gray-400 mb-1">模型名</span>
                  <input
                    value={draft.model}
                    onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                    onBlur={(e) => commitSettings({ ...draft, model: e.target.value })}
                    type="text"
                    placeholder={getDefaultModelForMode(draft.apiMode)}
                    className={inputClass}
                  />
                  <p className={hintClass}>第三方服务商可能使用不同模型名，这里允许自由填写。</p>
                </label>

                <label className="flex items-start gap-2 rounded-2xl border border-[rgba(120,95,72,0.12)] bg-[rgba(255,252,247,0.58)] p-3 text-sm text-[rgba(82,61,46,0.86)] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={draft.rememberCustomKey}
                    onChange={(e) => {
                      const nextDraft = { ...draft, rememberCustomKey: e.target.checked }
                      setDraft(nextDraft)
                      commitSettings(nextDraft)
                    }}
                    className="mt-1"
                  />
                  <span>
                    记住在本机
                    <span className="block text-[11px] leading-5 text-[rgba(124,109,97,0.78)]">
                      勾选后会保存到当前浏览器 localStorage；不勾选则刷新后需要重新填写。
                    </span>
                  </span>
                </label>
              </div>
            </section>
          )}

          <section className="pt-5 border-t border-[rgba(120,95,72,0.12)] dark:border-white/[0.08]">
            <h4 className={sectionTitleClass}>图片接口</h4>
            <div className="space-y-4">
              <label className="block">
                <span className="block text-xs text-[rgba(110,92,75,0.82)] dark:text-gray-400 mb-1">API 类型</span>
                <Select
                  value={draft.apiMode}
                  onChange={(value) => {
                    const apiMode = value as AppSettings['apiMode']
                    const nextModel =
                      draft.model === DEFAULT_IMAGES_MODEL || draft.model === DEFAULT_RESPONSES_MODEL
                        ? getDefaultModelForMode(apiMode)
                        : draft.model
                    const nextDraft = { ...draft, apiMode, model: nextModel }
                    setDraft(nextDraft)
                    commitSettings(nextDraft)
                  }}
                  options={[
                    { label: 'Images API (/v1/images)', value: 'images' },
                    { label: 'Responses API (/v1/responses)', value: 'responses' },
                  ]}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="block text-xs text-[rgba(110,92,75,0.82)] dark:text-gray-400 mb-1">请求超时（秒）</span>
                <input
                  value={timeoutInput}
                  onChange={(e) => setTimeoutInput(e.target.value)}
                  onBlur={commitTimeout}
                  type="number"
                  min={10}
                  max={600}
                  className={inputClass}
                />
                <p className={hintClass}>生成通常需要 30-60 秒，请保持页面打开。</p>
              </label>
            </div>
          </section>

          <section className="pt-5 border-t border-[rgba(120,95,72,0.12)] dark:border-white/[0.08]">
            <h4 className={sectionTitleClass}>高级开发</h4>
            <div className="space-y-4">
              <label className="block">
                <span className="block text-xs text-[rgba(110,92,75,0.82)] dark:text-gray-400 mb-1">调用方式</span>
                <Select
                  value={draft.transportMode}
                  onChange={(value) => {
                    const transportMode = value as AppSettings['transportMode']
                    const nextDraft = {
                      ...draft,
                      transportMode,
                      credentialMode: transportMode === 'server' ? draft.credentialMode : 'custom' as const,
                    }
                    setDraft(nextDraft)
                    commitSettings(nextDraft)
                  }}
                  options={[
                    { label: '云端代理（推荐）', value: 'server' },
                    { label: '浏览器直连', value: 'direct' },
                    { label: '本地桥接', value: 'bridge' },
                  ]}
                  className={inputClass}
                />
                <p className={hintClass}>公网分享默认使用云端代理；本地桥接仅用于本机开发或自用。</p>
              </label>

              {draft.transportMode === 'bridge' && (
                <label className="block">
                  <span className="block text-xs text-[rgba(110,92,75,0.82)] dark:text-gray-400 mb-1">本地桥接 URL</span>
                  <input
                    value={draft.bridgeUrl}
                    onChange={(e) => setDraft((prev) => ({ ...prev, bridgeUrl: e.target.value }))}
                    onBlur={(e) => commitSettings({ ...draft, bridgeUrl: e.target.value })}
                    type="text"
                    placeholder={DEFAULT_BRIDGE_URL}
                    className={inputClass}
                  />
                </label>
              )}

              <label className="flex items-center justify-between rounded-2xl border border-[rgba(120,95,72,0.12)] bg-[rgba(255,252,247,0.58)] p-3 text-sm text-[rgba(82,61,46,0.86)] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300">
                <span>Codex CLI 兼容模式</span>
                <input
                  type="checkbox"
                  checked={draft.codexCli}
                  onChange={(e) => {
                    const nextDraft = { ...draft, codexCli: e.target.checked }
                    setDraft(nextDraft)
                    commitSettings(nextDraft)
                  }}
                />
              </label>
            </div>
          </section>

          <section className="pt-5 border-t border-[rgba(120,95,72,0.12)] dark:border-white/[0.08]">
            <h4 className={sectionTitleClass}>数据管理</h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => exportData()}
                  className="flex-1 rounded-2xl border border-[rgba(120,95,72,0.12)] bg-[rgba(255,247,239,0.8)] px-4 py-2.5 text-sm text-[rgb(82,61,46)] transition hover:bg-[rgba(255,241,228,0.95)] dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]"
                >
                  导出
                </button>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="flex-1 rounded-2xl border border-[rgba(120,95,72,0.12)] bg-[rgba(255,247,239,0.8)] px-4 py-2.5 text-sm text-[rgb(82,61,46)] transition hover:bg-[rgba(255,241,228,0.95)] dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]"
                >
                  导入
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>
              <button
                onClick={() =>
                  setConfirmDialog({
                    title: '清空所有数据',
                    message: '确定要清空所有任务记录和图片数据吗？此操作不可恢复。',
                    action: () => clearAllData(),
                  })
                }
                className="w-full rounded-2xl border border-[rgba(184,92,75,0.24)] bg-[rgba(184,92,75,0.08)] px-4 py-2.5 text-sm text-[rgb(166,82,65)] transition hover:bg-[rgba(184,92,75,0.12)] dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
              >
                清空所有数据
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
