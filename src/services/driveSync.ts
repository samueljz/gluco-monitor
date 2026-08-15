/// <reference types="gapi" />
/// <reference types="gapi.client.drive-v3" />
/// <reference types="google.accounts" />

import { ref } from 'vue'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'GlucoMonitorBackup.json'
const TOKEN_KEY = 'gdm_google_token'

export const isGapiLoaded = ref(false)
export const isSignedIn = ref(false)
export const isSyncing = ref(false)

let tokenClient: any = null

export function initGoogleApi() {
  if (!CLIENT_ID) return

  // Load gapi client
  if (window.gapi) {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      })
      isGapiLoaded.value = true
      
      const savedToken = localStorage.getItem(TOKEN_KEY)
      if (savedToken) {
        gapi.client.setToken(JSON.parse(savedToken))
        isSignedIn.value = true
        syncData()
      }
    })
  }

  // Load identity services
  if (window.google) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error !== undefined) {
          throw tokenResponse
        }
        localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenResponse))
        isSignedIn.value = true
        syncData() // Automatically sync on login
      },
    })
  }
}

export function handleAuthClick() {
  if (!tokenClient) {
    alert("Google Client ID is missing! Please configure VITE_GOOGLE_CLIENT_ID in your .env file.")
    return
  }
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' })
  } else {
    tokenClient.requestAccessToken({ prompt: '' })
  }
}

export function handleSignoutClick() {
  const token = gapi.client.getToken()
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken(null)
      localStorage.removeItem(TOKEN_KEY)
      isSignedIn.value = false
    })
  } else {
    localStorage.removeItem(TOKEN_KEY)
    isSignedIn.value = false
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

export function syncData() {
  if (syncTimeout) window.clearTimeout(syncTimeout)
  syncTimeout = window.setTimeout(async () => {
    if (!isSignedIn.value) return
    isSyncing.value = true

    try {
    const fileId = await findBackupFile()
    
    // Gather all local storage data
    const appData: Record<string, any> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('gdm_')) {
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
      // Fetch remote data first to merge if needed, but for now we'll just do a 2-way merge
      // Actually, simple approach: push local up. If remote is newer, we pull.
      // For a robust sync, we will just download remote, merge locally, and upload the result.
      const remoteData = await downloadFile(fileId)
      if (remoteData) {
        mergeData(remoteData, appData)
        // re-upload merged data
        const mergedContent = JSON.stringify(appData)
        const mergedFile = new Blob([mergedContent], { type: 'application/json' })
        const mergedForm = new FormData()
        mergedForm.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        mergedForm.append('file', mergedFile)
        
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${gapi.client.getToken().access_token}`,
          },
          body: mergedForm,
        })
      }
    } else {
      // Create new file
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gapi.client.getToken().access_token}`,
        },
        body: form,
      })
    }
    
  } catch (err: any) {
    console.error('Sync failed', err)
    if (err?.status === 401) {
      handleSignoutClick()
    }
  } finally {
    isSyncing.value = false
  }
  }, 1000)
}

async function downloadFile(fileId: string): Promise<Record<string, any> | null> {
  const response = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media'
  })
  return typeof response.result === 'string' ? JSON.parse(response.result) : response.result
}

function mergeData(remote: Record<string, any>, local: Record<string, any>) {
  // Simple merge strategy: For each key, if remote exists, save to local storage. 
  // Then update local object so it can be uploaded as merged.
  // We prioritize remote to keep multiple devices in sync on load.
  for (const key of Object.keys(remote)) {
    if (key.startsWith('gdm_')) {
      const val = typeof remote[key] === 'object' ? JSON.stringify(remote[key]) : remote[key]
      localStorage.setItem(key, val)
      local[key] = remote[key]
    }
  }
  // Refresh page or trigger a reload event if needed so the UI reflects synced data
  window.dispatchEvent(new CustomEvent('gdm_sync_complete'))
}
