<script>
import jsQR from 'jsqr'
import { useMuseumwayfinding } from '../stores/museumWayfinding.js'

export default {
  name: 'QRScanner',
  data() {
    return {
      store: useMuseumwayfinding(),
      scanning: false,
      videoElement: null,
      canvasElement: null,
      isStarting: false,
      stream: null,
      animFrameId: null,
      qrLibraryLoaded: false,
      scannedData: null,
      scanError: null,
      scanComplete: false,
      statusText: '',
      statusClass: ''
    }
  },
  computed: {
    warningCirclePath() {
      return 'M12 8v4m0 4h.01'
    },
    scanResultText() {
      return this.store.isInRoom ? '[OK] Location set!' : ''
    }
  },
  methods: {
    setStatus(text, cls = '') {
      this.statusText = text
      this.statusClass = cls
    },

    async startScanning() {
      if (this.isStarting || this.scanning) return

      this.isStarting = true
      this.scanError = null
      this.scannedData = null
      this.scanComplete = false
      this.scanning = true

      try {
        this.setStatus('Requesting camera...', 'status-loading')

        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        })

        this.setStatus('Camera granted, loading decoder...', 'status-loading')

        await this.waitForVideoElement()

        if (!this.videoElement) throw new Error('Camera view not found.')

        this.videoElement.srcObject = this.stream

        this.setStatus('Starting camera...', 'status-loading')
        const metaLoaded = this.waitForVideoMetadata(this.videoElement)
        await Promise.race([metaLoaded, this.timeout(2000)])

        this.videoElement.play().catch(() => {
          console.warn('[QRScanner] Autoplay blocked -- stream active but video may not play.')
        })

        this.setStatus('Camera ready', 'status-success')

        if (!this.qrLibraryLoaded) await this.loadJsQRLibrary()

        this.scanComplete = false
        this.animateScanLoop()
      } catch (err) {
        console.error('[QRScanner] Start failed:', err.message || err)
        this.stopScanning()
        if (err.name === 'NotAllowedError') {
          this.setStatus('Permission denied', 'status-error')
          this.scanError = 'Camera access was blocked. Please allow camera permissions and try again.'
        } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
          this.setStatus('No camera', 'status-error')
          this.scanError = 'No camera device detected on this system.'
        } else {
          this.setStatus('Error', 'status-error')
          this.scanError = `Camera error: ${err.message || err}`
        }
      } finally {
        this.isStarting = false
      }
    },

    stopScanning() {
      if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null }
      this.scanning = false
      this.scanComplete = false
      this.scannedData = null

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
        this.stream = null
      }

      this.setStatus('')

      if (this.videoElement && typeof this.videoElement.srcObject !== 'undefined') {
        this.videoElement.srcObject = null
      }
    },

    async loadJsQRLibrary() {
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const code = await response.text()
        const scriptEl = document.createElement('script')
        scriptEl.textContent = code
        document.head.appendChild(scriptEl)

        this.qrLibraryLoaded = true
      } catch (err) {
        console.error('[QRScanner] Failed to load jsQR:', err.message || err)
        this.scanError = 'QR decoder could not be loaded -- check your network connection.'
        throw err
      }
    },

    animateScanLoop(timestamp) {
      if (!this.scanning) return

      const video = this.videoElement

      if (!video || video.readyState < 2) {
        this.animFrameId = requestAnimationFrame(() => this.animateScanLoop())
        return
      }

      const now = performance.now()
      const TARGET_FPS = 15
      const FRAME_INTERVAL = 1000 / TARGET_FPS
      if (timestamp && timestamp - (this._lastFrameTime || 0) < FRAME_INTERVAL * 0.8) {
        this.animFrameId = requestAnimationFrame(() => this.animateScanLoop())
        return
      }
      this._lastFrameTime = now

      const canvas = this.canvasElement

      if (!canvas || !video.videoWidth || !video.videoHeight) {
        this.animFrameId = requestAnimationFrame(() => this.animateScanLoop())
        return
      }
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      if (this.qrLibraryLoaded && typeof jsQR === 'function') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height)
        if (qrCode?.data) {
          this.handleScanResult(qrCode.data)
          return
        }
      }

      this.animFrameId = requestAnimationFrame(() => this.animateScanLoop())
    },

    handleScanResult(data) {
      this.scanComplete = true
      this.scannedData = data

      if (data.startsWith('room_')) {
        this.store.setCurrentLocation(data.replace(/^room_/, ''))
      } else if (data.startsWith('artwork_')) {
        this.store.setDestinationArtwork(data.replace(/^artwork_/, ''))
      }

      this.stopScanning()
    },

    waitForVideoElement() {
      return new Promise((resolve, reject) => {
        let attempts = 0
        const maxAttempts = 50

        const check = () => {
          if (!this.scanning || this.$refs.videoEl) resolve(true)
          else if (++attempts >= maxAttempts) reject(new Error('Video element not rendered in time.'))
          else setTimeout(check, Math.min(20 * attempts, 500))
        }

        check()
      })
    },

    waitForVideoMetadata(video) {
      return new Promise((resolve) => {
        const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); resolve() }
        video.addEventListener('loadedmetadata', onLoaded, { once: true })
        setTimeout(resolve, 2000)
      })
    },

    timeout(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }
  },
  beforeUnmount() {
    this.stopScanning()
  }
}
</script>

<template>
  <div class="qr-scanner">
    <!-- Initial State -->
    <div v-if="!scanning" class="scanner-controls">
      <button @click="startScanning" :disabled="isStarting" class="btn btn-primary">Start Scanning</button>
      <p>Scan a QR code in any room or artwork display.</p>
    </div>

    <!-- Active State -->
    <div v-else class="scanning-area">
      <div :class="['status-badge', statusClass]">{{ statusText }}</div>

      <video ref="videoEl" autoplay playsinline muted class="scanner-video"></video>

      <canvas ref="canvasEl" style="display:none;"></canvas>

      <!-- Controls -->
      <div class="scanning-controls">
        <p v-if="!scanComplete && qrLibraryLoaded">{{ statusText === 'Camera ready' ? 'Point camera at a QR code...' : '' }}</p>
        <button @click.stop="stopScanning" class="btn btn-secondary">Stop</button>
      </div>

      <!-- Error display -->
      <Transition name="fade" mode="out-in">
        <div v-if="scanError" key="error" class="scan-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path :d="warningCirclePath"/>
          </svg>
          {{ scanError }}
        </div>
      </Transition>

      <!-- Success display -->
      <Transition name="fade" mode="out-in">
        <div v-if="scanComplete && !scanError" key="success" class="scan-result">
          <h3>Scan Result</h3>
          <pre>{{ scannedData }}</pre>
          <p :class="{ success: store.isInRoom }">{{ scanResultText }}</p>
        </div>
      </Transition>
    </div>

    <!-- QR Library loading indicator -->
    <Transition name="fade">
      <div v-if="!qrLibraryLoaded && !scanError" class="library-loading">Loading QR decoder...</div>
    </Transition>
  </div>
</template>

<style scoped>
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
  color: var(--smk-ink);
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
  color: var(--smk-muted);
  margin: 0;
}

.scanning-area {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 12px;
}

.status-badge {
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 0;
  font-weight: 500;
  text-align: center;
  width: fit-content;
  min-height: 36px;
  display: flex;
  align-items: center;
}

.status-loading {
  background-color: var(--smk-surface);
  color: var(--smk-ink);
  border-left: 3px solid var(--smk-ink);
}

.status-error {
  background-color: var(--smk-surface);
  color: var(--smk-ink);
  border-left: 3px solid var(--smk-ink);
}

.status-success {
  background-color: var(--smk-paper);
  color: var(--smk-ink);
  border-left: 3px solid var(--smk-ink);
}

.scanner-video {
  width: 100%;
  max-width: 100%;
  border-radius: 0;
  object-fit: cover;
  background-color: #000;
  aspect-ratio: 4/3;
  touch-action: none;
}

.scanning-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0;
}

.scan-error,
.scan-result {
  width: 100%;
  text-align: left;
  padding: 16px;
  border-radius: 0;
  font-size: 15px;
  margin-top: 8px;
  line-height: 1.5;
}

.scan-error {
  background-color: var(--smk-surface);
  color: var(--smk-ink);
  display: flex;
  align-items: center;
  gap: 10px;
  border-left: 3px solid var(--smk-ink);
}

.scan-error svg {
  stroke: var(--smk-ink);
  flex-shrink: 0;
}

.scan-result {
  background-color: var(--smk-surface);
  color: var(--smk-ink);
}

.scan-result h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: var(--smk-ink);
}

.scan-result pre {
  background: var(--smk-surface);
  padding: 12px;
  border-radius: 0;
  border: 1px solid var(--smk-line);
  word-break: break-all;
  font-family: monospace;
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.library-loading {
  text-align: center;
  color: var(--smk-muted);
  font-size: 14px;
  padding: 12px 0;
}

.scan-result .success {
  color: var(--smk-ink);
  font-weight: 600;
  margin-bottom: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px 20px;
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  background: var(--smk-ink);
  color: var(--smk-paper);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.btn:hover:not(:disabled) {
  background: #333;
}

.btn-secondary {
  background: var(--smk-paper);
  color: var(--smk-ink);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--smk-surface);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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

@media (min-width: 768px) {
  .qr-scanner {
    padding: 20px;
  }

  .scanner-controls {
    padding: 40px;
  }

  .scanner-video {
    max-width: 480px;
    border-radius: 0;
  }

  .scan-error,
  .scan-result {
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }
}
</style>
