/// <reference types="gapi" />
/// <reference types="gapi.client.drive-v3" />
/// <reference types="google.accounts" />

import { ref } from 'vue'
import { loadGoogleScripts } from '../utils/googleScriptLoader'
import { hasAccessToken, isScheduleSlotArray, isStoredReadingMap, isThemeValue } from '../utils/guards'

type GoogleTokenResponse = google.accounts.oauth2.TokenResponse

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'GlucoMonitorBackup.json'
const TOKEN_KEY = 'gdm_google_token'
const TOKEN_EXPIRY_KEY = 'gdm_token_expires_at'
const SCHEDULE_KEY_PREFIX = 'gdm_schedule_'
const READINGS_KEY_PREFIX = 'gdm_readings_'
const THEME_KEY = 'gdm_theme'

export const isGapiLoaded = ref(false)
export const isSignedIn = ref(false)
export const isSyncing = ref(false)
export const syncError = ref<string | null>(null)
// True once silent (popup-free) token renewal has actually failed, meaning
// the user must click through a visible Google consent prompt to continue.
export const needsReauth = ref(false)

let tokenClient: google.accounts.oauth2.TokenClient | null = null
let pendingRefreshPromise: Promise<boolean> | null = null
let refreshLoopHandle: number | null = null
let oauthState: string = crypto.randomUUID()

// Proactively renew the token well before it expires so a real sync call
// never has to block on a just-in-time silent refresh.
const PROACTIVE_REFRESH_WINDOW_MS = 5 * 60 * 1000
const REFRESH_LOOP_INTERVAL_MS = 60 * 1000

function saveTokenResponse(tokenResponse: GoogleTokenResponse) {
  const expiresInSeconds = Number(tokenResponse.expires_in) || 3600
  // Subtract 120 seconds as a safety margin
  const expiresAt = Date.now() + Math.max(expiresInSeconds - 120, 60) * 1000

  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenResponse))
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString())

  if (window.gapi && gapi.client) {
    gapi.client.setToken(tokenResponse)
  }

  needsReauth.value = false
}

export function isTokenExpired(): boolean {
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0)
  return !expiresAt || Date.now() >= expiresAt
}

function isTokenExpiringSoon(): boolean {
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0)
  return !expiresAt || expiresAt - Date.now() <= PROACTIVE_REFRESH_WINDOW_MS
}

export async function ensureValidToken(): Promise<boolean> {
  // If memory client has token and not expired, it's valid
  if (!isTokenExpired() && window.gapi && gapi.client && gapi.client.getToken()?.access_token) {
    return true
  }

  // If we have a saved token that hasn't expired yet, rehydrate into gapi
  if (!isTokenExpired()) {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    if (savedToken) {
      try {
        const parsed = JSON.parse(savedToken)
        if (hasAccessToken(parsed) && window.gapi && gapi.client) {
          gapi.client.setToken(parsed)
          return true
        }
      } catch {
        // Fallback to requesting fresh token below
      }
    }
  }

  // Need refresh: if a silent refresh is already running, wait for it
  if (pendingRefreshPromise) {
    return pendingRefreshPromise
  }

  const client = tokenClient
  if (!client) {
    return false
  }

  // Request new token silently without user interaction popup. Google will
  // grant this without a prompt as long as the user still has an active
  // Google session and previously consented; it only fails once that's no
  // longer true (signed out of Google, revoked access, etc).
  pendingRefreshPromise = new Promise<boolean>((resolve) => {
    let resolved = false

    const finish = (ok: boolean) => {
      if (resolved) return
      resolved = true
      pendingRefreshPromise = null
      if (!ok) needsReauth.value = true
      resolve(ok)
    }

    const timeout = setTimeout(() => finish(false), 5000)

    // `callback` isn't part of the ambient OverridableTokenClientConfig type,
    // but Google's Identity Services runtime does honor a per-call override
    // here (a documented-in-practice, if not officially typed, way to give a
    // silent refresh its own callback distinct from the one registered in
    // initTokenClient).
    const overrideConfig: google.accounts.oauth2.OverridableTokenClientConfig & {
      callback: (response: GoogleTokenResponse) => void
    } = {
      prompt: '',
      state: oauthState,
      callback: (response) => {
        clearTimeout(timeout)
        if (response && !response.error) {
          saveTokenResponse(response)
          isSignedIn.value = true
          finish(true)
        } else {
          console.warn('Silent token refresh failed:', response?.error)
          finish(false)
        }
      },
    }

    try {
      client.requestAccessToken(overrideConfig)
    } catch {
      clearTimeout(timeout)
      finish(false)
    }
  })

  return pendingRefreshPromise
}

// Keep the token fresh in the background so an interactive sync rarely has
// to wait on (or risk failing) a just-in-time silent refresh.
function startProactiveRefreshLoop() {
  if (refreshLoopHandle !== null) return
  refreshLoopHandle = window.setInterval(() => {
    if (!isSignedIn.value || needsReauth.value) return
    if (isTokenExpiringSoon()) {
      ensureValidToken()
    }
  }, REFRESH_LOOP_INTERVAL_MS)
}

export async function initGoogleApi() {
  if (!CLIENT_ID) return

  await loadGoogleScripts()

  // Load identity services
  if (window.google) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: GoogleTokenResponse) => {
        if (tokenResponse.error !== undefined) {
          throw tokenResponse
        }
        // Validate state to prevent CSRF attacks — always enforced
        if (tokenResponse.state !== oauthState) {
          console.error('OAuth state mismatch — possible CSRF attack, ignoring response')
          return
        }
        // Rotate state after each successful response
        oauthState = crypto.randomUUID()
        saveTokenResponse(tokenResponse)
        isSignedIn.value = true
        syncData(true) // Automatically sync on login and prompt
      },
    })
  }

  // Load gapi client
  if (window.gapi) {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      })
      isGapiLoaded.value = true

      const savedToken = localStorage.getItem(TOKEN_KEY)
      if (savedToken) {
        isSignedIn.value = true
        const valid = await ensureValidToken()
        if (valid) {
          syncData()
        }
      }

      startProactiveRefreshLoop()
    })
  }
}

export function handleAuthClick() {
  if (!tokenClient) {
    syncError.value = 'Google Client ID is missing. Configure VITE_GOOGLE_CLIENT_ID in your .env file.'
    return
  }
  syncError.value = null
  const currentToken = window.gapi?.client?.getToken()
  // Only show the visible Google consent screen once silent renewal has
  // actually failed (or we've never authenticated). Otherwise try silently
  // first so the user isn't interrupted for a routine expiry.
  if (!currentToken || needsReauth.value) {
    tokenClient.requestAccessToken({ prompt: 'consent', state: oauthState })
  } else {
    tokenClient.requestAccessToken({ prompt: '', state: oauthState })
  }
}

export function handleSignoutClick() {
  const token = window.gapi?.client?.getToken()
  const clearSession = () => {
    if (window.gapi?.client) gapi.client.setToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    isSignedIn.value = false
    syncError.value = null
    needsReauth.value = false
  }

  if (token && token.access_token && typeof google?.accounts?.oauth2?.revoke === 'function') {
    google.accounts.oauth2.revoke(token.access_token, () => {
      clearSession()
    })
  } else {
    clearSession()
  }
}

async function findBackupFile(): Promise<string | null> {
  const response = await gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id, name)',
  })
  const files = response.result.files
  if (files && files.length > 0) {
    const file = files[0]
    return file?.id || null
  }
  return null
}

let syncTimeout: number | null = null
let syncQueued = false

export function syncData(promptUser: boolean = false) {
  if (syncTimeout) window.clearTimeout(syncTimeout)
  syncTimeout = window.setTimeout(() => runSync(promptUser), 1000)
}

// Guards against overlapping sync runs: if a sync is already in flight when
// another is requested, we don't start a second one (which could interleave
// two Drive read/patch cycles on the same file) — we just remember to run
// once more right after the current one finishes.
async function runSync(promptUser: boolean) {
  if (isSyncing.value) {
    syncQueued = true
    return
  }

  if (!isSignedIn.value) return

  const tokenValid = await ensureValidToken()
  if (!tokenValid) {
    console.warn('Cannot sync: Google authentication token is expired or unavailable.')
    syncError.value = 'Auth session expired'
    return
  }

  isSyncing.value = true
  syncError.value = null

  try {
    const fileId = await findBackupFile()
    const currentToken = gapi.client.getToken()?.access_token
    if (!currentToken) throw new Error('Missing access token')

    // Gather all local storage data, excluding token credentials
    const appData: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('gdm_') && key !== TOKEN_KEY && key !== TOKEN_EXPIRY_KEY) {
        try {
          appData[key] = JSON.parse(localStorage.getItem(key) || 'null')
        } catch {
          appData[key] = localStorage.getItem(key)
        }
      }
    }

    const fileContent = JSON.stringify(appData)
    const file = new Blob([fileContent], { type: 'application/json' })
    const metadata = {
      name: FILE_NAME,
      mimeType: 'application/json',
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', file)

    if (fileId) {
      const remoteData = await downloadFile(fileId)
      if (remoteData) {
        let prioritizeRemote = true
        if (promptUser) {
          prioritizeRemote = window.confirm('Do you want to overwrite your local data with the backup from Google Drive?\n\nClick OK to overwrite local data.\nClick Cancel to keep local data and merge.')
        } else {
          prioritizeRemote = false
        }

        mergeData(remoteData, appData, prioritizeRemote)

        // Re-upload merged data
        const mergedContent = JSON.stringify(appData)
        const mergedFile = new Blob([mergedContent], { type: 'application/json' })
        const mergedForm = new FormData()
        mergedForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        mergedForm.append('file', mergedFile)

        const patchRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
          body: mergedForm,
        })
        if (!patchRes.ok) throw new Error(`Patch failed with status: ${patchRes.status}`)
      }
    } else {
      // Create new file
      const postRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
        body: form,
      })
      if (!postRes.ok) throw new Error(`Create failed with status: ${postRes.status}`)
    }
    syncError.value = null
  } catch (err) {
    console.error('Sync failed', err)
    const message = err instanceof Error ? err.message : undefined
    syncError.value = message || 'Sync failed'
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status: unknown }).status : undefined
    if (status === 401 || message?.includes('401')) {
      handleSignoutClick()
    }
  } finally {
    isSyncing.value = false
    if (syncQueued) {
      syncQueued = false
      runSync(false)
    }
  }
}

async function downloadFile(fileId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    })
    if (typeof response.result === 'string') {
      return JSON.parse(response.result)
    }
    // gapi's types describe files.get()'s result as Drive File metadata,
    // but with alt: 'media' it's actually the raw file body we requested.
    return (response.result as unknown as Record<string, unknown>) || null
  } catch (err) {
    console.error('Failed to download or parse remote backup', err)
    return null
  }
}

function isValidGdmValue(key: string, value: unknown): boolean {
  if (key === THEME_KEY) return isThemeValue(value)
  if (key.startsWith(SCHEDULE_KEY_PREFIX)) return isScheduleSlotArray(value)
  if (key.startsWith(READINGS_KEY_PREFIX)) return isStoredReadingMap(value)
  // Unknown/future keys: we can't validate a shape we don't know, so accept
  // them as-is rather than silently dropping forward-compatible data.
  return true
}

// Pure merge decision: for each recognized, shape-valid gdm_ key in the
// remote backup, decide whether it should overwrite the local value.
// Malformed remote values (e.g. a corrupted or tampered backup file) are
// skipped instead of corrupting local state.
export function computeMerge(
  remote: Record<string, unknown>,
  local: Record<string, unknown>,
  prioritizeRemote: boolean
): { merged: Record<string, unknown>; changedKeys: string[] } {
  const merged = { ...local }
  const changedKeys: string[] = []

  for (const key of Object.keys(remote)) {
    if (!key.startsWith('gdm_') || key === TOKEN_KEY || key === TOKEN_EXPIRY_KEY) continue

    const value = remote[key]
    if (!isValidGdmValue(key, value)) {
      console.warn(`Skipping malformed remote backup key "${key}"`)
      continue
    }

    if (prioritizeRemote || !(key in local)) {
      merged[key] = value
      changedKeys.push(key)
    }
  }

  return { merged, changedKeys }
}

function mergeData(remote: Record<string, unknown>, local: Record<string, unknown>, prioritizeRemote: boolean) {
  const { merged, changedKeys } = computeMerge(remote, local, prioritizeRemote)

  for (const key of changedKeys) {
    const value = merged[key]
    const raw = typeof value === 'object' ? JSON.stringify(value) : String(value)
    localStorage.setItem(key, raw)
    local[key] = value
  }

  window.dispatchEvent(new CustomEvent('gdm_sync_complete'))
}
