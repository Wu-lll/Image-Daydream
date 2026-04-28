// ===== 设置 =====

export type ApiMode = 'images' | 'responses'
export type TransportMode = 'server' | 'direct' | 'bridge'
export type CredentialMode = 'site' | 'custom'
export type ProviderLineId = 'line1' | 'line2'

export interface AppSettings {
  credentialMode: CredentialMode
  providerLine: ProviderLineId
  baseUrl: string
  apiKey: string
  transportMode: TransportMode
  bridgeUrl: string
  model: string
  timeout: number
  apiMode: ApiMode
  codexCli: boolean
  rememberCustomKey: boolean
}

const DEFAULT_BASE_URL = import.meta.env.VITE_DEFAULT_API_URL?.trim() || 'https://api.pptoken.org/v1'
export const DEFAULT_BRIDGE_URL = import.meta.env.VITE_DEFAULT_BRIDGE_URL?.trim() || 'http://127.0.0.1:8765/v1'
export const DEFAULT_IMAGES_MODEL = 'gpt-image-2'
export const DEFAULT_RESPONSES_MODEL = 'gpt-5.5'

export const API_PRESETS = [
  {
    id: 'line1',
    label: '线路 1',
    transportMode: 'server',
    baseUrl: 'https://www.souimagery.fun/v1',
    apiKey: '',
  },
  {
    id: 'line2',
    label: '线路 2',
    transportMode: 'server',
    baseUrl: 'https://api.pptoken.org/v1',
    apiKey: '',
  },
] as const

export const DEFAULT_API_PRESET = API_PRESETS[1]

export const DEFAULT_SETTINGS: AppSettings = {
  credentialMode: 'site',
  providerLine: 'line2',
  baseUrl: import.meta.env.VITE_DEFAULT_API_URL?.trim() || DEFAULT_API_PRESET.baseUrl || DEFAULT_BASE_URL,
  apiKey: '',
  transportMode: DEFAULT_API_PRESET.transportMode,
  bridgeUrl: DEFAULT_BRIDGE_URL,
  model: DEFAULT_IMAGES_MODEL,
  timeout: 300,
  apiMode: 'images',
  codexCli: false,
  rememberCustomKey: false,
}

// ===== 任务参数 =====

export interface TaskParams {
  size: string
  quality: 'auto' | 'low' | 'medium' | 'high'
  output_format: 'png' | 'jpeg' | 'webp'
  output_compression: number | null
  moderation: 'auto' | 'low'
  n: number
}

export const DEFAULT_PARAMS: TaskParams = {
  size: 'auto',
  quality: 'auto',
  output_format: 'png',
  output_compression: null,
  moderation: 'auto',
  n: 1,
}

// ===== 输入图片（UI 层面） =====

export interface InputImage {
  /** IndexedDB image store 的 id（SHA-256 hash） */
  id: string
  /** data URL，用于预览 */
  dataUrl: string
}

// ===== 任务记录 =====

export type TaskStatus = 'running' | 'done' | 'error'

export interface TaskRecord {
  id: string
  prompt: string
  params: TaskParams
  /** API 返回的实际生效参数，用于标记与请求值不一致的情况 */
  actualParams?: Partial<TaskParams>
  /** 输出图片对应的实际生效参数，key 为 outputImages 中的图片 id */
  actualParamsByImage?: Record<string, Partial<TaskParams>>
  /** 输出图片对应的 API 改写提示词，key 为 outputImages 中的图片 id */
  revisedPromptByImage?: Record<string, string>
  /** 输入图片的 image store id 列表 */
  inputImageIds: string[]
  /** 输出图片的 image store id 列表 */
  outputImages: string[]
  status: TaskStatus
  error: string | null
  createdAt: number
  finishedAt: number | null
  /** 总耗时毫秒 */
  elapsed: number | null
  /** 是否收藏 */
  isFavorite?: boolean
}

// ===== IndexedDB 存储的图片 =====

export interface StoredImage {
  id: string
  dataUrl: string
  /** 图片首次存储时间（ms） */
  createdAt?: number
  /** 图片来源：用户上传 / API 生成 */
  source?: 'upload' | 'generated'
}

// ===== API 请求体 =====

export interface ImageGenerationRequest {
  model: string
  prompt: string
  size: string
  quality: string
  output_format: string
  moderation: string
  output_compression?: number
  n?: number
}

// ===== API 响应 =====

export interface ImageResponseItem {
  b64_json?: string
  url?: string
  revised_prompt?: string
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
}

export interface ImageApiResponse {
  data: ImageResponseItem[]
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
  n?: number
}

export interface ResponsesOutputItem {
  type?: string
  result?: string | {
    b64_json?: string
    image?: string
    data?: string
  }
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
  revised_prompt?: string
}

export interface ResponsesApiResponse {
  output?: ResponsesOutputItem[]
  tools?: Array<{
    type?: string
    size?: string
    quality?: string
    output_format?: string
    output_compression?: number
    moderation?: string
    n?: number
  }>
}

// ===== 导出数据 =====

/** ZIP manifest.json 格式 */
export interface ExportData {
  version: number
  exportedAt: string
  settings: AppSettings
  tasks: TaskRecord[]
  /** imageId → 图片信息 */
  imageFiles: Record<string, {
    path: string
    createdAt?: number
    source?: 'upload' | 'generated'
  }>
}
