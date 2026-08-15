/// <reference types="gapi" />
/// <reference types="gapi.client.drive-v3" />
/// <reference types="google.accounts" />

import { ref } from 'vue'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'GlucoMonitorBackup.json'
const TOKEN_KEY = 'gdm_google_token'
const TOKEN_EXPIRY_KEY = 'gdm_token_expires_at'

export const isGapiLoaded = ref(false)
export const isSignedIn = ref(false)
export const isSyncing = ref(false)
export const syncError = ref<string | null>(null)

let tokenClient: any = null
let pendingRefreshPromise: Promise<boolean> | null = null

function saveTokenResponse(tokenResponse: any) {
  const expiresInSeconds = Number(tokenResponse.expires_in) || 3600
  // Subtract 120 seconds as a safety margin
  const expiresAt = Date.now() + Math.max(expiresInSeconds - 120, 60) * 1000
  
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenResponse))
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString())
  
  if (window.gapi && gapi.client) {
    gapi.client.setToken(tokenResponse)
  }
}

export function isTokenExpired(): boolean {
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0)
  return !expiresAt || Date.now() >= expiresAt
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
        if (parsed?.access_token && window.gapi && gapi.client) {
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

  if (!tokenClient) {
    return false
  }

  // Request new token silently without user interaction popup
  pendingRefreshPromise = new Promise<boolean>((resolve) => {
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        pendingRefreshPromise = null
        resolve(false)
      }
    }, 5000)

    try {
      tokenClient.requestAccessToken({
        prompt: '',
        callback: (response: any) => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          pendingRefreshPromise = null

          if (response && !response.error) {
            saveTokenResponse(response)
            isSignedIn.value = true
            resolve(true)
          } else {
            console.warn('Silent token refresh failed:', response?.error)
            resolve(false)
          }
        },
      })
    } catch (err) {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        pendingRefreshPromise = null
        resolve(false)
      }
    }
  })

  return pendingRefreshPromise
}

export function initGoogleApi() {
  if (!CLIENT_ID) return

  // Load identity services
  if (window.google) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error !== undefined) {
          throw tokenResponse
        }
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
    })
  }
}

export function handleAuthClick() {
  if (!tokenClient) {
    alert("Google Client ID is missing! Please configure VITE_GOOGLE_CLIENT_ID in your .env file.")
    return
  }
  syncError.value = null
  const currentToken = window.gapi?.client?.getToken()
  if (!currentToken || isTokenExpired()) {
    tokenClient.requestAccessToken({ prompt: 'consent' })
  } else {
    tokenClient.requestAccessToken({ prompt: '' })
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

export function syncData(promptUser: boolean = false) {
  if (syncTimeout) window.clearTimeout(syncTimeout)
  syncTimeout = window.setTimeout(async () => {
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
      const appData: Record<string, any> = {}
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
    } catch (err: any) {
      console.error('Sync failed', err)
      syncError.value = err?.message || 'Sync failed'
      if (err?.status === 401 || err?.message?.includes('401')) {
        handleSignoutClick()
      }
    } finally {
      isSyncing.value = false
    }
  }, 1000)
}

async function downloadFile(fileId: string): Promise<Record<string, any> | null> {
  try {
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    })
    if (typeof response.result === 'string') {
      return JSON.parse(response.result)
    }
    return response.result || null
  } catch (err) {
    console.error('Failed to download or parse remote backup', err)
    return null
  }
}

function mergeData(remote: Record<string, any>, local: Record<string, any>, prioritizeRemote: boolean) {
  for (const key of Object.keys(remote)) {
    if (key.startsWith('gdm_') && key !== TOKEN_KEY && key !== TOKEN_EXPIRY_KEY) {
      if (prioritizeRemote || !(key in local)) {
        const val = typeof remote[key] === 'object' ? JSON.stringify(remote[key]) : remote[key]
        localStorage.setItem(key, val)
        local[key] = remote[key]
      }
    }
  }
  window.dispatchEvent(new CustomEvent('gdm_sync_complete'))
}
