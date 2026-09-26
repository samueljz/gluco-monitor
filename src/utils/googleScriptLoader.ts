const GOOGLE_SCRIPT_SRCS = [
  'https://accounts.google.com/gsi/client',
  'https://apis.google.com/js/api.js',
]

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve()
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

// Dynamically injects Google's Identity Services + gapi scripts and resolves
// once both are ready, instead of polling window.gapi/window.google.
export function loadGoogleScripts(): Promise<void> {
  return Promise.all(GOOGLE_SCRIPT_SRCS.map(loadScript)).then(() => undefined)
}
