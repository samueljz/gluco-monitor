<template>
  <div class="flex items-center gap-2">
    <button 
      v-if="!isSignedIn" 
      @click="handleAuthClick"
      class="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.42 10.975A11 11 0 0 0 12.02 2c-4.4 0-8.2 2.6-10 6.6l3 2.5c1.4-2.8 4.3-4.7 7.6-4.7 2.2 0 4.2.8 5.8 2.3l4-4M2 13.025A11 11 0 0 0 11.98 22c4.4 0 8.2-2.6 10-6.6l-3-2.5c-1.4 2.8-4.3 4.7-7.6 4.7-2.2 0-4.2-.8-5.8-2.3l-4 4"/>
      </svg>
      Sync to Drive
    </button>
    <div v-else class="flex items-center gap-2">
      <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <svg v-if="isSyncing" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="h-3.5 w-3.5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        {{ isSyncing ? 'Syncing...' : 'Synced' }}
      </span>
      <button 
        @click="() => syncData(true)" 
        :disabled="isSyncing"
        class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        title="Sync Now"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.66 5.66"/>
        </svg>
      </button>
      <button 
        @click="handleSignoutClick" 
        class="text-xs text-rose-500 hover:text-rose-600 transition-colors ml-1"
      >
        Sign Out
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { isSignedIn, isSyncing, handleAuthClick, handleSignoutClick, syncData, initGoogleApi } from '../services/driveSync'

onMounted(() => {
  // Wait for Google scripts to load
  const checkInterval = setInterval(() => {
    if (window.gapi && window.google) {
      clearInterval(checkInterval)
      initGoogleApi()
    }
  }, 100)
})
</script>
