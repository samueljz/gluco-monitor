<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { NCard, NEmpty, NSpin } from 'naive-ui'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface Reading {
  value: number;
  timestamp: number;
  slotId: string;
  dateStr: string;
}

const allReadings = ref<Reading[]>([])
const displayedReadings = ref<Reading[]>([])
const chartData = ref({
  labels: [] as string[],
  datasets: [{
    label: 'Glucose Level (mmol/L)',
    data: [] as number[],
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 2,
    tension: 0.3,
    fill: true,
  }]
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    }
  },
  scales: {
    y: {
      min: 0,
      max: 15,
    }
  }
}

const isLoading = ref(true)
const observerTarget = ref<HTMLElement | null>(null)
const itemsPerPage = 10
let currentPage = 1

onMounted(() => {
  loadData()
  
  const observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      loadMore()
    }
  }, {
    rootMargin: '100px',
    threshold: 0.1
  })
  
  if (observerTarget.value) {
    observer.observe(observerTarget.value)
  }
})

function getDaysArray(numDays: number) {
  const arr = []
  const today = new Date()
  for (let i = 0; i < numDays; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    arr.push(dateStr)
  }
  return arr
}

function loadData() {
  isLoading.value = true
  
  // We need recent 2 days for the graph. But we might want ALL historical readings for the list.
  // We can scan localStorage for all keys starting with 'gdm_readings_'
  const keys = Object.keys(localStorage).filter(k => k.startsWith('gdm_readings_'))
  
  // Sort keys descending (newest first)
  keys.sort((a, b) => b.localeCompare(a))
  
  let readings: Reading[] = []
  
  keys.forEach(key => {
    const dateStr = key.replace('gdm_readings_', '')
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}')
      Object.keys(data).forEach(slotId => {
        const item = data[slotId]
        if (item.value > 0) { // Only log actual readings, not snacks
          readings.push({
            value: item.value,
            timestamp: item.timestamp,
            slotId: slotId,
            dateStr: dateStr
          })
        }
      })
    } catch (e) {
      console.error('Error parsing', key)
    }
  })
  
  // Sort readings by timestamp descending
  readings.sort((a, b) => b.timestamp - a.timestamp)
  allReadings.value = readings
  
  // Load initial page
  displayedReadings.value = readings.slice(0, itemsPerPage)
  
  // Prepare chart data (Recent 2 days)
  const recentDays = getDaysArray(2)
  const graphReadings = readings
    .filter(r => recentDays.includes(r.dateStr))
    .sort((a, b) => a.timestamp - b.timestamp) // Ascending for graph
  
  chartData.value.labels = graphReadings.map(r => {
    const d = new Date(r.timestamp)
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  chartData.value.datasets[0]!.data = graphReadings.map(r => r.value)
  
  isLoading.value = false
}

function loadMore() {
  if (displayedReadings.value.length < allReadings.value.length) {
    const nextItems = allReadings.value.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
    displayedReadings.value.push(...nextItems)
    currentPage++
  }
}

function formatFriendlyTime(ts: number) {
  const d = new Date(ts)
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

function formatSlotName(slotId: string) {
  return slotId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto no-scrollbar pb-32 px-4 transition-colors duration-500">
    <div v-if="isLoading" class="flex justify-center py-10">
      <n-spin size="large" />
    </div>
    
    <template v-else>
      <n-card class="w-full mb-6 rounded-3xl shadow-sm border-0" :bordered="false" size="small">
        <h3 class="text-lg font-bold mb-4 ml-2">Recent Readings (48h)</h3>
        <div v-if="chartData.datasets[0]?.data?.length" class="h-48">
          <Line :data="chartData" :options="chartOptions" />
        </div>
        <n-empty v-else description="No recent readings" class="my-6" />
      </n-card>

      <h3 class="text-lg font-bold mb-4 ml-2">All Readings</h3>
      
      <div v-if="allReadings.length === 0">
        <n-empty description="No historical readings found" />
      </div>
      
      <div v-else class="flex flex-col gap-3">
        <n-card 
          v-for="(reading, i) in displayedReadings" 
          :key="i"
          class="w-full rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-800"
          :bordered="false"
          size="small"
        >
          <div class="flex justify-between items-center px-2 py-1">
            <div class="flex flex-col">
              <span class="font-bold text-slate-800 dark:text-slate-100 text-[16px]">{{ formatSlotName(reading.slotId) }}</span>
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <span>{{ reading.dateStr }}</span>
                <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                <span>{{ formatFriendlyTime(reading.timestamp) }}</span>
              </div>
            </div>
            
            <div class="flex flex-col items-end">
              <span class="text-2xl font-black" :class="[
                reading.value > 10 ? 'text-red-500' : 
                reading.value < 4 ? 'text-orange-500' : 'text-blue-500'
              ]">{{ reading.value.toFixed(1) }}</span>
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">mmol/L</span>
            </div>
          </div>
        </n-card>
        
        <!-- Observer target for lazy loading -->
        <div ref="observerTarget" class="h-10 w-full flex justify-center items-center">
           <n-spin v-if="displayedReadings.length < allReadings.length" size="small" />
           <span v-else class="text-xs text-slate-400 font-semibold mb-4 mt-2">No more readings</span>
        </div>
      </div>
    </template>
  </div>
</template>
