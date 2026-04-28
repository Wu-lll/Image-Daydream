import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, 'config.json')

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim()
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
        : []
    const pathname = normalizedSegments.length ? `/${normalizedSegments.join('/')}` : ''
    return `${url.origin}${pathname}`
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

async function loadConfig() {
  try {
    const raw = await readFile(configPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function readLegacyValue(filePath) {
  try {
    return (await readFile(filePath, 'utf8')).trim()
  } catch {
    return ''
  }
}

async function resolveDefaults(config) {
  const legacyDir = typeof config.legacyToolConfigDir === 'string' && config.legacyToolConfigDir.trim()
    ? config.legacyToolConfigDir.trim()
    : ''

  const legacyBaseUrl = legacyDir
    ? await readLegacyValue(path.join(legacyDir, 'openai_base_url.txt'))
    : ''
  const legacyApiKey = legacyDir
    ? await readLegacyValue(path.join(legacyDir, 'openai_api_key.txt'))
    : ''

  const fallbacks = Array.isArray(config.fallbacks)
    ? config.fallbacks
      .map((item) => ({
        baseUrl: normalizeBaseUrl(item?.baseUrl || ''),
        apiKey: String(item?.apiKey || '').trim(),
      }))
      .filter((item) => item.baseUrl && item.apiKey)
    : []

  return {
    defaultBaseUrl: normalizeBaseUrl(config.defaultBaseUrl || legacyBaseUrl || ''),
    defaultApiKey: String(config.defaultApiKey || legacyApiKey || '').trim(),
    fallbacks,
    allowOrigin: typeof config.allowOrigin === 'string' && config.allowOrigin.trim() ? config.allowOrigin.trim() : '*',
    port: Number(config.port) > 0 ? Number(config.port) : 8765,
  }
}

function setCorsHeaders(res, allowOrigin) {
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-OpenAI-Base-Url, X-OpenAI-Api-Key')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Cache-Control', 'no-store')
}

function sendJson(res, allowOrigin, status, payload) {
  setCorsHeaders(res, allowOrigin)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function getUpstreamConfig(req, defaults) {
  const baseUrlHeader = Array.isArray(req.headers['x-openai-base-url'])
    ? req.headers['x-openai-base-url'][0]
    : req.headers['x-openai-base-url']
  const apiKeyHeader = Array.isArray(req.headers['x-openai-api-key'])
    ? req.headers['x-openai-api-key'][0]
    : req.headers['x-openai-api-key']

  const baseUrl = normalizeBaseUrl(baseUrlHeader || defaults.defaultBaseUrl || '')
  const apiKey = String(apiKeyHeader || defaults.defaultApiKey || '').trim()

  return { baseUrl, apiKey }
}

function getUpstreamCandidates(req, defaults) {
  const primary = getUpstreamConfig(req, defaults)
  const candidates = []

  if (primary.baseUrl && primary.apiKey) {
    candidates.push(primary)
  }

  for (const fallback of defaults.fallbacks || []) {
    if (!fallback.baseUrl || !fallback.apiKey) continue
    const exists = candidates.some((item) => item.baseUrl === fallback.baseUrl && item.apiKey === fallback.apiKey)
    if (!exists) candidates.push(fallback)
  }

  return candidates
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

async function fetchUrlAsBase64(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`图片下载失败：HTTP ${response.status}`)
  }
  return toBase64(await response.arrayBuffer())
}

async function normalizeImagesPayload(payload) {
  if (!payload || !Array.isArray(payload.data)) return payload

  for (const item of payload.data) {
    if (!item || typeof item !== 'object') continue
    if (!item.b64_json && typeof item.url === 'string' && /^https?:\/\//i.test(item.url)) {
      item.b64_json = await fetchUrlAsBase64(item.url)
      delete item.url
    }
  }

  return payload
}

async function normalizeResponsesPayload(payload) {
  if (!payload || !Array.isArray(payload.output)) return payload

  for (const item of payload.output) {
    if (!item || item.type !== 'image_generation_call') continue
    const result = item.result

    if (typeof result === 'object' && result) {
      if (typeof result.b64_json === 'string' && result.b64_json.trim()) {
        item.result = result.b64_json
        continue
      }
      if (typeof result.image === 'string' && result.image.trim()) {
        item.result = result.image
        continue
      }
      if (typeof result.data === 'string' && result.data.trim()) {
        item.result = result.data
        continue
      }
      if (typeof result.url === 'string' && /^https?:\/\//i.test(result.url)) {
        item.result = await fetchUrlAsBase64(result.url)
      }
    }
  }

  return payload
}

function hasUsableImagePayload(url, payload) {
  if (!payload) return false

  if (url.startsWith('/v1/images/')) {
    return Array.isArray(payload.data) && payload.data.some((item) => item?.b64_json || item?.url)
  }

  if (url === '/v1/responses') {
    return Array.isArray(payload.output) && payload.output.some((item) => item?.type === 'image_generation_call' && item?.result)
  }

  return true
}

async function callUpstream(candidate, req, body, contentType, index) {
  const endpointUrl = `${candidate.baseUrl}${req.url}`
  const upstreamHeaders = {
    Authorization: `Bearer ${candidate.apiKey}`,
    'Cache-Control': 'no-store, no-cache, max-age=0',
    Pragma: 'no-cache',
  }

  if (contentType) {
    upstreamHeaders['Content-Type'] = contentType
  }

  const upstreamResponse = await fetch(endpointUrl, {
    method: req.method,
    headers: upstreamHeaders,
    body: body.length ? body : undefined,
  })

  const text = await upstreamResponse.text()
  let payload = null

  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    return {
      ok: upstreamResponse.ok,
      status: upstreamResponse.status,
      contentType: upstreamResponse.headers.get('content-type') || 'text/plain; charset=utf-8',
      text,
      payload: null,
      usable: upstreamResponse.ok,
    }
  }

  if (upstreamResponse.ok) {
    if (req.url.startsWith('/v1/images/')) {
      payload = await normalizeImagesPayload(payload)
    } else if (req.url === '/v1/responses') {
      payload = await normalizeResponsesPayload(payload)
    }
  }

  return {
    ok: upstreamResponse.ok,
    status: upstreamResponse.status,
    contentType: 'application/json; charset=utf-8',
    text: JSON.stringify(payload),
    payload,
    usable: upstreamResponse.ok && hasUsableImagePayload(req.url, payload),
    upstreamIndex: index,
    upstreamOrigin: new URL(candidate.baseUrl).origin,
  }
}

async function proxyRequest(req, res, defaults) {
  const candidates = getUpstreamCandidates(req, defaults)
  if (!candidates.length) {
    sendJson(res, defaults.allowOrigin, 400, {
      error: {
        message: '缺少上游 API URL 或 API Key。请在前端填写 URL + Key，或在 local-bridge/config.json 中提供默认值。',
      },
    })
    return
  }

  const body = await readRequestBody(req)
  const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : ''
  let lastResult = null
  let lastError = null

  for (const [index, candidate] of candidates.entries()) {
    try {
      const result = await callUpstream(candidate, req, body, contentType, index)
      lastResult = result
      if (result.usable) {
        setCorsHeaders(res, defaults.allowOrigin)
        res.setHeader('X-Bridge-Upstream-Index', String(result.upstreamIndex))
        res.setHeader('X-Bridge-Upstream-Origin', result.upstreamOrigin)
        res.writeHead(result.status, { 'Content-Type': result.contentType })
        res.end(result.text)
        return
      }
    } catch (error) {
      lastError = error
    }
  }

  setCorsHeaders(res, defaults.allowOrigin)
  if (lastResult) {
    res.setHeader('X-Bridge-Upstream-Index', String(lastResult.upstreamIndex))
    res.setHeader('X-Bridge-Upstream-Origin', lastResult.upstreamOrigin)
    res.writeHead(lastResult.status, { 'Content-Type': lastResult.contentType })
    res.end(lastResult.text)
    return
  }

  res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({
    error: {
      message: lastError instanceof Error ? lastError.message : '所有上游节点均请求失败',
    },
  }))
}

const rawConfig = await loadConfig()
const defaults = await resolveDefaults(rawConfig)

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res, defaults.allowOrigin)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, defaults.allowOrigin, 200, {
        ok: true,
        bridge: 'gpt-image-playground-local-bridge',
        baseUrlConfigured: Boolean(defaults.defaultBaseUrl),
        apiKeyConfigured: Boolean(defaults.defaultApiKey),
        fallbackCount: defaults.fallbacks?.length || 0,
      })
      return
    }

    if (
      req.method === 'POST' &&
      (req.url === '/v1/images/generations' || req.url === '/v1/images/edits' || req.url === '/v1/responses')
    ) {
      await proxyRequest(req, res, defaults)
      return
    }

    sendJson(res, defaults.allowOrigin, 404, {
      error: {
        message: `Unsupported route: ${req.method} ${req.url}`,
      },
    })
  } catch (error) {
    sendJson(res, defaults.allowOrigin, 500, {
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
})

server.listen(defaults.port, '127.0.0.1', () => {
  console.log(`Local bridge listening on http://127.0.0.1:${defaults.port}`)
})
