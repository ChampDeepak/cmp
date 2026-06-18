// Centralized API client for the AI Content Moderation backend.
// Base URL comes from Vite env var, defaulting to localhost:8000.

export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '')

/**
 * Thrown for any non-2xx response. Carries the HTTP status so callers
 * can special-case things like 409 (conflict / already exists).
 */
export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch (networkErr) {
    // fetch only rejects on network failure / CORS / server down.
    throw new ApiError(
      'Cannot reach the API. Is the backend running?',
      0,
      networkErr.message
    )
  }

  let body = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    body = await res.json().catch(() => null)
  } else {
    body = await res.text().catch(() => null)
  }

  if (!res.ok) {
    // FastAPI puts error info in `detail`.
    const detail =
      body && typeof body === 'object' && body.detail ? body.detail : body
    const message =
      typeof detail === 'string'
        ? detail
        : `Request failed with status ${res.status}`
    throw new ApiError(message, res.status, detail)
  }

  return body
}

export const api = {
  // GET / -> health
  health: () => request('/'),

  // GET /platforms -> [{id, name, email}]
  getPlatforms: () => request('/platforms'),

  // POST /register-platform
  registerPlatform: (name, email) =>
    request('/register-platform', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    }),

  // POST /moderate  (platform_id MUST be int, age is a string)
  moderate: ({ text, platformId, age }) =>
    request('/moderate', {
      method: 'POST',
      body: JSON.stringify({
        text,
        platform_id: Number(platformId),
        age,
      }),
    }),

  // GET /queue/stats
  getQueueStats: () => request('/queue/stats'),

  // GET /moderation-results?platform_id=<optional int>
  getResults: (platformId) => {
    const qs =
      platformId != null && platformId !== ''
        ? `?platform_id=${Number(platformId)}`
        : ''
    return request(`/moderation-results${qs}`)
  },

  // GET /admin/dashboard-stats
  getDashboardStats: () => request('/admin/dashboard-stats'),
}
