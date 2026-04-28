import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')
const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT || 3210)
const SESSION_COOKIE = 'id_session'
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 36) * 60 * 60 * 1000
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_DAYS || 30) * 24 * 60 * 60 * 1000
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me'
const ACCESS_CODE = process.env.ACCESS_CODE || ''
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 25 * 1024 * 1024)
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 210000)
const SITE_FAILOVER_ENABLED = String(process.env.SITE_FAILOVER_ENABLED || 'true').toLowerCase() !== 'false'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''

  const input = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(input)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const v1Index = pathSegments.indexOf('v1')
    const normalizedSegments = v1Index >= 0
      ? pathSegments.slice(0, v1Index + 1)
      : pathSegments.length
        ? [...pathSegments, 'v1']
        : ['v1']
    return `${url.origin}/${normalizedSegments.join('/')}`.replace(/\/+$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

function inferProviderKind(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl).toLowerCase()
  if (!normalized) return null
  if (normalized.includes('pptoken')) return 'pptoken'
  if (normalized.includes('souimagery')) return 'sou'
  return null
}

function resolvePhysicalLine(line) {
  const line1Kind = inferProviderKind(process.env.LINE1_BASE_URL || '')
  const line2Kind = inferProviderKind(process.env.LINE2_BASE_URL || '')

  // Compatibility shim:
  // Earlier deployments often stored PPToken in LINE1 and Sou in LINE2.
  // If that inverted layout is still present, swap the backing env set so
  // logical line2 becomes PPToken without forcing an immediate env rewrite.
  if (line1Kind === 'pptoken' && line2Kind === 'sou') {
    return line === 'line2' ? 'line1' : 'line2'
  }

  return line
}

function providerConfig(line) {
  const physicalLine = resolvePhysicalLine(line)
  const prefix = physicalLine === 'line2' ? 'LINE2' : 'LINE1'
  const labelPrefix = line === 'line2' ? 'LINE2' : 'LINE1'
  const fallbackPrefix = line === 'line2' ? 'PPTOKEN' : 'SOU'
  const fallbackBaseUrl = line === 'line2' ? 'https://api.pptoken.org/v1' : 'https://www.souimagery.fun/v1'
  return {
    id: line === 'line2' ? 'line2' : 'line1',
    label: process.env[`${labelPrefix}_LABEL`] || (line === 'line2' ? '线路 2' : '线路 1'),
    baseUrl: normalizeBaseUrl(process.env[`${prefix}_BASE_URL`] || process.env[`${fallbackPrefix}_BASE_URL`] || fallbackBaseUrl),
    apiKey: process.env[`${prefix}_API_KEY`] || process.env[`${fallbackPrefix}_API_KEY`] || '',
    model: process.env[`${prefix}_MODEL`] || process.env.DEFAULT_IMAGE_MODEL || 'gpt-image-2',
  }
}

function otherLine(line) {
  return line === 'line2' ? 'line1' : 'line2'
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url')
}

function encodeSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

function decodeSession(value) {
  if (!value || typeof value !== 'string') return null
  const [body, signature] = value.split('.')
  if (!body || !signature || sign(body) !== signature) return null

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function parseCookies(req) {
  const cookies = {}
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key) cookies[key] = decodeURIComponent(rest.join('=') || '')
  }
  return cookies
}

function cookieOptions(req, maxAgeSeconds) {
  const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : ''
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
}

function setSessionCookie(req, res, payload) {
  const maxAge = Math.max(1, Math.floor(SESSION_TTL_MS / 1000))
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(encodeSession(payload))}; ${cookieOptions(req, maxAge)}`)
}

function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieOptions(req, 0)}`)
}

function getValidSession(req, res) {
  const session = decodeSession(parseCookies(req)[SESSION_COOKIE])
  if (!session?.iat || !session?.lastSeen) return null

  const now = Date.now()
  if (now - session.lastSeen > SESSION_TTL_MS) return null
  if (now - session.iat > SESSION_MAX_AGE_MS) return null

  const refreshed = { ...session, lastSeen: now }
  if (res) setSessionCookie(req, res, refreshed)
  return refreshed
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let length = 0
    req.on('data', (chunk) => {
      length += chunk.length
      if (length > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJson(req) {
  const body = await readBody(req)
  if (!body.length) return {}
  return JSON.parse(body.toString('utf8'))
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function isApiPath(url) {
  return url.pathname.startsWith('/api/')
}

function sendStatic(req, res, url) {
  let filePath = path.join(DIST_DIR, decodeURIComponent(url.pathname))
  if (!filePath.startsWith(DIST_DIR)) {
    sendText(res, 403, 'Forbidden')
    return
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 404, 'Not found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    })
    res.end(data)
  })
}

function makeUpstreamUrl(baseUrl, apiPath) {
  const normalized = normalizeBaseUrl(baseUrl)
  const cleanPath = apiPath.replace(/^\/api\/openai\/v1\/?/, '').replace(/^\/+/, '')
  return `${normalized}/${cleanPath}`
}

function buildCredentialCandidates(req) {
  const credentialMode = String(req.headers['x-image-credential-mode'] || 'site').toLowerCase()
  if (credentialMode === 'custom') {
    const baseUrl = normalizeBaseUrl(req.headers['x-openai-base-url'])
    const apiKey = String(req.headers['x-openai-api-key'] || '').trim()
    if (!baseUrl || !apiKey) {
      throw new Error('请先填写自己的 Base URL 和 API Key。')
    }
    return [{
      mode: 'custom',
      logicalLine: 'custom',
      label: '我的 API',
      baseUrl,
      apiKey,
      model: process.env.DEFAULT_IMAGE_MODEL || 'gpt-image-2',
    }]
  }

  const requestedLine = req.headers['x-image-line'] === 'line2' ? 'line2' : 'line1'
  const primary = providerConfig(requestedLine)
  if (!primary.apiKey) {
    throw new Error(`${primary.label} 尚未在服务端配置 API Key。`)
  }

  const candidates = [{
    mode: 'site',
    logicalLine: requestedLine,
    ...primary,
  }]

  if (!SITE_FAILOVER_ENABLED) return candidates

  const fallbackLine = otherLine(requestedLine)
  const fallback = providerConfig(fallbackLine)
  const isDistinct = fallback.apiKey && (
    fallback.baseUrl !== primary.baseUrl ||
    fallback.apiKey !== primary.apiKey ||
    fallback.model !== primary.model
  )

  if (isDistinct) {
    candidates.push({
      mode: 'site',
      logicalLine: fallbackLine,
      ...fallback,
    })
  }

  return candidates
}

function sanitizeHeaders(headers) {
  const next = {}
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase()
    if (['host', 'connection', 'content-length', 'authorization', 'cookie', 'expect'].includes(lower)) continue
    if (lower.startsWith('x-image-') || lower.startsWith('x-openai-')) continue
    next[key] = value
  }
  return next
}

function imageMimeFromFormat(format) {
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  return 'image/png'
}

function payloadNeedsNormalization(apiPath, payload) {
  if (!payload || typeof payload !== 'object') return false

  if (apiPath.startsWith('/api/openai/v1/images/')) {
    return Array.isArray(payload.data) && payload.data.some(
      (item) => item && typeof item === 'object' && typeof item.url === 'string' && /^https?:\/\//i.test(item.url),
    )
  }

  if (apiPath === '/api/openai/v1/responses') {
    return Array.isArray(payload.output) && payload.output.some((item) => {
      if (!item || typeof item !== 'object' || item.type !== 'image_generation_call') return false
      const result = item.result
      return typeof result?.url === 'string' && /^https?:\/\//i.test(result.url)
    })
  }

  return false
}

function hasUsableImagePayload(apiPath, payload) {
  if (!payload) return false

  if (apiPath.startsWith('/api/openai/v1/images/')) {
    return Array.isArray(payload.data) && payload.data.some((item) => item?.b64_json || item?.url)
  }

  if (apiPath === '/api/openai/v1/responses') {
    return Array.isArray(payload.output) && payload.output.some(
      (item) => item?.type === 'image_generation_call' && item?.result,
    )
  }

  return true
}

function normalizeBase64Image(value, fallbackMime) {
  if (!value || typeof value !== 'string') return ''
  return value.startsWith('data:') ? value : `data:${fallbackMime};base64,${value}`
}

async function fetchImageAsBase64(url, fallbackMime) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') || fallbackMime
  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    b64_json: buffer.toString('base64'),
    mime: contentType,
  }
}

async function normalizeImageJson(payload, fallbackMime) {
  if (!payload || typeof payload !== 'object') return payload

  if (Array.isArray(payload.data)) {
    payload.data = await Promise.all(payload.data.map(async (item) => {
      if (!item || typeof item !== 'object') return item
      if (item.b64_json || !item.url) return item
      const image = await fetchImageAsBase64(item.url, fallbackMime)
      const { url, ...rest } = item
      return { ...rest, b64_json: image.b64_json }
    }))
  }

  return payload
}

async function normalizeResponsePayload(apiPath, payload, fallbackMime) {
  if (apiPath.startsWith('/api/openai/v1/images/')) {
    return normalizeImageJson(payload, fallbackMime)
  }

  return payload
}

async function callUpstream(candidate, req, body, contentType, index) {
  const endpointUrl = makeUpstreamUrl(candidate.baseUrl, req.url)
  let requestBody = body
  if (candidate.model && contentType.includes('application/json') && body.length) {
    try {
      const json = JSON.parse(body.toString('utf8'))
      if (json && typeof json === 'object') {
        json.model = candidate.model
        requestBody = Buffer.from(JSON.stringify(json))
      }
    } catch {
      requestBody = body
    }
  }

  const upstreamHeaders = {
    ...sanitizeHeaders(req.headers),
    Authorization: `Bearer ${candidate.apiKey}`,
  }

  if (requestBody.length && !upstreamHeaders['content-type'] && contentType) {
    upstreamHeaders['content-type'] = contentType
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error(`上游请求超时（>${UPSTREAM_TIMEOUT_MS}ms）`)), UPSTREAM_TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const upstream = await fetch(endpointUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : requestBody,
      duplex: 'half',
      signal: controller.signal,
    })

    const elapsedMs = Date.now() - startedAt
    const responseContentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'

    if (!responseContentType.includes('application/json')) {
      const rawBody = Buffer.from(await upstream.arrayBuffer())
      return {
        ok: upstream.ok,
        usable: upstream.ok,
        status: upstream.status,
        text: rawBody.toString('utf8'),
        contentType: responseContentType,
        payload: null,
        elapsedMs,
        normalized: false,
        upstreamIndex: index,
        upstreamOrigin: new URL(candidate.baseUrl).origin,
        logicalLine: candidate.logicalLine,
        label: candidate.label,
      }
    }

    const text = await upstream.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      return {
        ok: upstream.ok,
        usable: upstream.ok,
        status: upstream.status,
        text,
        contentType: responseContentType,
        payload: null,
        elapsedMs,
        normalized: false,
        upstreamIndex: index,
        upstreamOrigin: new URL(candidate.baseUrl).origin,
        logicalLine: candidate.logicalLine,
        label: candidate.label,
      }
    }

    let responseText = text
    let normalized = false
    if (upstream.ok && payloadNeedsNormalization(req.url, payload)) {
      normalized = true
      const normalizedPayload = await normalizeResponsePayload(req.url, payload, imageMimeFromFormat(payload?.output_format))
      payload = normalizedPayload
      responseText = JSON.stringify(normalizedPayload)
    }

    return {
      ok: upstream.ok,
      usable: upstream.ok && hasUsableImagePayload(req.url, payload),
      status: upstream.status,
      text: responseText,
      contentType: responseContentType,
      payload,
      elapsedMs,
      normalized,
      upstreamIndex: index,
      upstreamOrigin: new URL(candidate.baseUrl).origin,
      logicalLine: candidate.logicalLine,
      label: candidate.label,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function handleProxy(req, res, url) {
  const session = getValidSession(req, res)
  if (!session) {
    sendJson(res, 401, { error: { message: '访问已过期，请重新输入口令。' } })
    return
  }

  let candidates
  try {
    candidates = buildCredentialCandidates(req)
  } catch (error) {
    sendJson(res, 400, { error: { message: error.message } })
    return
  }

  let body = await readBody(req)
  const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : ''
  let lastResult = null
  let lastError = null

  try {
    for (const [index, candidate] of candidates.entries()) {
      try {
        const result = await callUpstream(candidate, req, body, contentType, index)
        lastResult = result
        if (result.usable) {
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('X-Proxy-Upstream-Index', String(result.upstreamIndex))
          res.setHeader('X-Proxy-Upstream-Origin', result.upstreamOrigin)
          res.setHeader('X-Proxy-Upstream-Line', result.logicalLine)
          res.setHeader('X-Proxy-Upstream-Elapsed-Ms', String(result.elapsedMs))
          res.setHeader('X-Proxy-Response-Normalized', result.normalized ? '1' : '0')
          res.writeHead(result.status, { 'Content-Type': result.contentType })
          res.end(result.text)
          return
        }
      } catch (error) {
        lastError = error
      }
    }

    if (lastResult) {
      const message = lastResult.payload?.error?.message || lastResult.payload?.message || `上游接口返回 HTTP ${lastResult.status}`
      sendJson(res, lastResult.status >= 400 ? lastResult.status : 502, { error: { message } })
      return
    }

    sendJson(res, 502, { error: { message: lastError instanceof Error ? lastError.message : '所有上游线路均请求失败。' } })
  } catch (error) {
    const cause = error?.cause?.message ? ` (${error.cause.message})` : ''
    sendJson(res, 502, {
      error: {
        message: error instanceof Error ? `${error.message}${cause}` : '上游接口请求失败。',
      },
    })
  }
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/api/session') {
    const session = getValidSession(req, res)
    sendJson(res, session ? 200 : 401, { ok: Boolean(session) })
    return
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    if (!ACCESS_CODE) {
      sendJson(res, 500, { error: 'ACCESS_CODE is not configured.' })
      return
    }

    try {
      const body = await readJson(req)
      if (!timingSafeEqual(body.accessCode || '', ACCESS_CODE)) {
        sendJson(res, 401, { error: 'Invalid access code.' })
        return
      }

      const now = Date.now()
      setSessionCookie(req, res, { iat: now, lastSeen: now })
      sendJson(res, 200, { ok: true })
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body.' })
    }
    return
  }

  if (url.pathname === '/api/logout' && req.method === 'POST') {
    clearSessionCookie(req, res)
    sendJson(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/api/providers') {
    const session = getValidSession(req, res)
    if (!session) {
      sendJson(res, 401, { error: 'Unauthorized.' })
      return
    }

    sendJson(res, 200, {
      providers: ['line1', 'line2'].map((line) => {
        const provider = providerConfig(line)
        return {
          id: provider.id,
          label: provider.label,
          model: provider.model,
          configured: Boolean(provider.apiKey),
        }
      }),
    })
    return
  }

  if (url.pathname.startsWith('/api/openai/v1/')) {
    await handleProxy(req, res, url)
    return
  }

  sendJson(res, 404, { error: 'Not found.' })
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (isApiPath(url)) {
    handleApi(req, res, url).catch((error) => {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal server error.' })
    })
    return
  }

  sendStatic(req, res, url)
})

server.listen(PORT, HOST, () => {
  console.log(`Image Daydream listening on http://${HOST}:${PORT}`)
})
