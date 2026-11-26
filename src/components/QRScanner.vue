<!-- QR Code Scanner Component -->
<template>
  <div class="qr-scanner">
    <!-- Initial State -- waiting for user to start scan (no transition needed) -->
    <div v-if="!scanning" class="scanner-controls">
      <button @click="startScanning" :disabled="isStarting" class="btn btn-primary">{{ t('qr.start') }}</button>
      <p>{{ t('qr.instruction') }}</p>
    </div>

    <!-- Active State -- camera is running (no transition needed) -->
    <div v-else class="scanning-area">
        <!-- Status indicator (permission -> stream ready) -->
        <div :class="['status-badge', statusClass]" role="status" aria-live="polite">{{ statusText }}</div>

        <!-- Camera preview -->
        <video ref="videoElement" autoplay playsinline muted class="scanner-video"></video>

        <!-- Hidden canvas for frame processing (jsQR reads from here) -->
        <canvas ref="canvasElement" style="display:none;"></canvas>

        <!-- Controls -->
        <div class="scanning-controls">
          <p v-if="!scanComplete && qrLibraryLoaded">{{ statusKey === 'cameraReady' ? t('qr.pointCamera') : '' }}</p>
          <button @click.stop="stopScanning" class="btn btn-secondary">{{ t('qr.stop') }}</button>
        </div>

        <!-- Success display -->
        <Transition name="fade" mode="out-in">
          <div v-if="scanComplete && !scanErrorKey" key="success" class="scan-result" role="status">
            <h3>{{ t('qr.scanResult') }}</h3>
            <pre>{{ scannedData }}</pre>
            <p :class="{ success: store.isInRoom }">{{ scanResultText }}</p>
          </div>
        </Transition>
      </div>

    <Transition name="fade" mode="out-in">
      <div v-if="scanErrorKey" key="error" class="scan-error" role="alert">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path :d="warningCirclePath"/>
        </svg>
        {{ t(scanErrorKey, scanErrorParams) }}
      </div>
    </Transition>

    <!-- QR Library loading indicator -->
    <Transition name="fade">
      <div v-if="!qrLibraryLoaded && !scanErrorKey" class="library-loading" role="status">{{ t('qr.loadingDecoder') }}</div>
    </Transition>
  </div>
</template>

<script setup>
const warningCirclePath = 'M12 8v4m0 4h.01'
// Warning circle background: <circle cx=\x2712\x27 cy=\x2712\x27 r=\x2710\x27/>
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import jsQR from 'jsqr';
import { useMuseumwayfinding } from '../stores/museumwayfinding.js'

const store = useMuseumwayfinding()
const { t } = useI18n()

// Local state
const scanning = ref(false)
const videoElement = ref(null)
const canvasElement = ref(null)
const isStarting = ref(false)     // Disables button while camera permission dialog shows up
let stream = null                 // MediaStream reference (stopped on unmount/stop)
let animFrameId = null            // requestAnimationFrame ID for scan loop

// Scan status -- tracks the pipeline: waiting -> requesting-permission -> loading-library -> ready -> scanning -> complete/error
const qrLibraryLoaded = ref(false)
const scannedData = ref(null)
const scanErrorKey = ref('')
const scanErrorParams = ref({})
const scanComplete = ref(false)   // QR was successfully decoded and processed

// Status badge text + color class (driven by pipeline state, not animation phases)
function setStatus(text, cls = '') {
  statusKey.value = text
  statusClass.value = cls
}

const statusKey = ref('')
const statusText = computed(() => statusKey.value ? t(`qr.status.${statusKey.value}`) : '')
const statusClass = ref('') // 'status-loading' | 'status-error' | 'status-success'

// Computed result message
const scanResultText = computed(() => store.isInRoom ? t('qr.locationSet') : '')

function startScanning() {
  if (isStarting.value || scanning.value) return

  isStarting.value = true
  scanErrorKey.value = ''
  scanErrorParams.value = {}
  scannedData.value = null
  scanComplete.value = false

  ;(async () => {
    try {
      // Set scanning FIRST so the <video> element renders in the DOM.
      scanning.value = true

      setStatus('requestingCamera', 'status-loading')

      // Step 1 -- Request permission (triggers browser dialog).
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })

      setStatus('loadingDecoder', 'status-loading')

      // Step 2 -- Wait for Vue to render the <video> element inside drawer panel.
      await waitForVideoElement()

      if (!videoElement.value) throw new Error('Camera view not found.')

      videoElement.value.srcObject = stream

      // Step 3 -- Wait for metadata then play (browsers require this sequence).
      setStatus('startingCamera', 'status-loading')
      const metaLoaded = waitForVideoMetadata(videoElement.value)
      await Promise.race([metaLoaded, timeout(2000)])

      videoElement.value.play().catch(() => {
        console.warn('[QRScanner] Autoplay blocked -- stream active but video may not play.')
      })

      setStatus('cameraReady', 'status-success')

      // Step 4 -- Load jsQR (lazy, once per session).
      if (!qrLibraryLoaded.value) await loadJsQRLibrary()

      scanComplete.value = false
      animateScanLoop()
    } catch (err) {
      console.error('[QRScanner] Start failed:', err.message || err)
      stopScanning()
      if (err.name === 'NotAllowedError') {
        setStatus('permissionDenied', 'status-error')
        scanErrorKey.value = 'qr.errors.cameraPermission'
      } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
        setStatus('noCamera', 'status-error')
        scanErrorKey.value = 'qr.errors.noCamera'
      } else {
        setStatus('error', 'status-error')
        scanErrorKey.value = 'qr.errors.camera'
        scanErrorParams.value = { error: err.message || err }
      }
    } finally {
      isStarting.value = false
    }
  })()
}

function stopScanning() {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null }
  scanning.value = false
  scanComplete.value = false
  scannedData.value = null

  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null }

  setStatus('')

  // Reset video so it can be reused on next start without stale srcObject.
  if (videoElement.value && typeof videoElement.value.srcObject !== 'undefined') {
    videoElement.value.srcObject = null
  }
}

async function loadJsQRLibrary() {
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const code = await response.text()
    const scriptEl = document.createElement('script')
    scriptEl.textContent = code
    document.head.appendChild(scriptEl)

    qrLibraryLoaded.value = true
  } catch (err) {
    console.error('[QRScanner] Failed to load jsQR:', err.message || err)
    scanErrorKey.value = 'qr.errors.decoder'
    throw err
  }
}

let lastFrameTime = 0 // Throttle on desktop browsers where camera stream is always "ready"
const TARGET_FPS = 15
const FRAME_INTERVAL = 1000 / TARGET_FPS

function animateScanLoop(timestamp) {
  if (!scanning.value) return

const video = videoElement.value

if (!video || video.readyState < 2) {
  animFrameId = requestAnimationFrame(animateScanLoop)
  return
}

  const now = performance.now()
  if (timestamp && timestamp - lastFrameTime < FRAME_INTERVAL * 0.8) {
    animFrameId = requestAnimationFrame(animateScanLoop)
    return
  }
  lastFrameTime = now

  //const video = videoElement.value
  const canvas = canvasElement.value

  // Ensure hidden canvas matches current video dimensions (can change on orientation/resize).
  if (!canvas || !video.videoWidth || !video.videoHeight) { animFrameId = requestAnimationFrame(animateScanLoop); return }
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  if (qrLibraryLoaded.value && typeof jsQR === 'function') {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height)
   // if (qrCode?.data) handleScanResult(qrCode.data) // Stops scanning loop on success.
 // } else { animFrameId = requestAnimationFrame(animateScanLoop) }
 if (qrCode?.data) {
  handleScanResult(qrCode.data)
  return
}
}

animFrameId = requestAnimationFrame(animateScanLoop)
}

function handleScanResult(data) {
  scanComplete.value = true
  scannedData.value = data

  if (data.startsWith('room_')) store.setCurrentLocation(data.replace(/^room_/, ''))
  else if (data.startsWith('artwork_')) store.setDestinationArtwork(data.replace(/^artwork_/, ''))

  stopScanning() // Auto-stop after successful read.
}

// -- Helpers --

function waitForVideoElement() {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 50

    function check() {
      if (!scanning.value || videoElement.value) resolve(true) // Unmounted or found.
      else if (++attempts >= maxAttempts) reject(new Error('Video element not rendered in time.'))
      else setTimeout(check, Math.min(20 * attempts, 500))    // Exponential backoff capped at 500ms.
    }

    check()
  })
}

function waitForVideoMetadata(video) {
  return new Promise((resolve) => {
    const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); resolve() }
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    setTimeout(resolve, 2000) // Fallback for browsers that skip loadedmetadata.
  })
}

function timeout(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

onUnmounted(stopScanning)
</script>

<style scoped>

/* ===== Mobile-First Layout ===== */
.qr-scanner {
  padding: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #1a4d78;
}

.scanner-controls {
  text-align: center;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.scanner-controls p {
  font-size: 15px;
  line-height: 1.5;
  color: #666;
  margin: 0;
}

.scanning-area {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 12px;
}

/* ===== Mobile-First Status Badge ===== */
.status-badge {
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  text-align: center;
  width: fit-content;
  min-height: 36px;
  display: flex;
  align-items: center;
}

.status-loading {
  background-color: #fff3cd;
  color: #856404;
}

.status-error {
  background-color: #f8d7da;
  color: #721c24;
}

.status-success {
  background-color: #d4edda;
  color: #155724;
}

/* ===== Mobile-First Camera Preview ===== */
.scanner-video {
  width: 100%;
  max-width: 100%;
  border-radius: 12px;
  object-fit: cover;
  background-color: #000;
  aspect-ratio: 4/3;
  /* Prevents iOS zoom */
  touch-action: none;
}

/* ===== Mobile-First Controls & Feedback ===== */
.scanning-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0;
}

.scanning-controls .btn {
  min-width: 120px;
}

.scan-error,
.scan-result {
  width: 100%;
  text-align: left;
  padding: 16px;
  border-radius: 12px;
  font-size: 15px;
  margin-top: 8px;
  line-height: 1.5;
}

.scan-error {
  background-color: #fff3f3;
  color: #dc3545;
  display: flex;
  align-items: center;
  gap: 10px;
}

.scan-result {
  background-color: #e9f7ef;
  color: #1a4d78;
}

.scan-result h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #28a745;
}

.scan-result pre {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  word-break: break-all;
  font-family: monospace;
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.library-loading {
  text-align: center;
  color: #6c757d;
  font-size: 14px;
  padding: 12px 0;
}

.scan-result .success {
  color: #28a745;
  font-weight: 600;
  margin-bottom: 0;
}

/* ===== Mobile-First Buttons ===== */
.btn {
  padding: 12px 24px;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  transition: opacity 0.2s, background-color 0.2s;
  min-height: 48px;
  /* Touch-friendly */
  -webkit-tap-highlight-color: transparent;
  font-weight: 500;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-primary {
  background-color: #28a745;
  color: white;
}

.btn-secondary {
  background-color: #dc3545;
  color: white;
}

/* ===== Small Mobile Optimization ===== */
@media (max-width: 400px) {
  .scanner-controls {
    padding: 20px 12px;
  }

  .status-badge {
    font-size: 13px;
    padding: 6px 12px;
  }

  .scan-error,
  .scan-result {
    padding: 12px;
    font-size: 14px;
  }

  .scanning-controls {
    flex-direction: column;
  }

  .scanning-controls .btn {
    width: 100%;
  }
}

/* ===== Tablet and Up ===== */
@media (min-width: 768px) {
  .qr-scanner {
    padding: 20px;
  }

  .scanner-controls {
    padding: 40px;
  }

  .scanner-video {
    max-width: 480px;
    border-radius: 12px;
  }

  .scan-error,
  .scan-result {
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }
}

.qr-scanner {
  height: auto;
  min-height: 0;
  color: var(--smk-ink);
}

.scanner-controls {
  padding: 20px 8px;
}

.scanner-controls p {
  max-width: 28rem;
  color: var(--smk-muted);
  line-height: 1.55;
}

.scanner-controls .btn,
.scanning-controls .btn {
  min-height: 48px;
  padding: 12px 20px;
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  font-weight: 600;
}

.scanner-controls .btn-primary {
  background: var(--smk-ink);
  color: var(--smk-paper);
}

.scanner-controls .btn-primary:hover:not(:disabled) {
  background: #333;
}

.scanning-controls .btn-secondary {
  background: var(--smk-paper);
  color: var(--smk-ink);
}

.scanning-controls .btn-secondary:hover:not(:disabled) {
  background: var(--smk-surface);
}

.scanning-area {
  gap: 14px;
}

.status-badge {
  justify-content: center;
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-surface);
  color: var(--smk-ink);
  font-weight: 600;
}

.status-loading {
  border-color: #9a9a94;
  background: #f0f0ed;
  color: var(--smk-ink);
}

.status-error {
  border-color: #9a9a94;
  background: #f0f0ed;
  color: #7a1717;
}

.status-success {
  border-color: #8a8a85;
  background: #e8e8e5;
  color: var(--smk-ink);
}

.scanner-video {
  max-height: min(52dvh, 480px);
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: #111;
}

.scanning-controls {
  gap: 12px;
}

.scan-error,
.scan-result {
  padding: 16px;
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-surface);
  color: var(--smk-ink);
  line-height: 1.55;
}

.scan-error {
  border-left: 3px solid #7a1717;
}

.scan-result h3 {
  color: var(--smk-ink);
  font-weight: 600;
}

.scan-result pre {
  overflow: auto;
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-paper);
  color: var(--smk-ink);
  font-family: "Hill SMK", Arial, sans-serif;
}

.scan-result .success {
  color: var(--smk-ink);
}

.library-loading {
  color: var(--smk-muted);
}

@media (min-width: 768px) {
  .scanner-video,
  .scan-error,
  .scan-result {
    max-width: 100%;
  }
}
</style>