/**
 * Rest-end cues (LG-017 §4): a synthesized two-tone chime and a vibration.
 * No audio file, so it works offline. Everything is feature-detected and
 * wrapped in try/catch; failure is silent.
 */
let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    if (audioContext) return audioContext
    if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null
    audioContext = new window.AudioContext()
    return audioContext
  } catch {
    return null
  }
}

/** Create or resume the shared context. Call it from a tap: Chrome blocks audio before a gesture. */
export function unlockAudio(): void {
  try {
    const context = getContext()
    if (context && context.state === 'suspended') void context.resume().catch(() => {})
  } catch {
    // Audio is optional.
  }
}

const PEAK_GAIN = 0.25
const RAMP = 0.015

function tone(context: AudioContext, frequency: number, start: number, duration: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // Linear attack and release ramps keep the edges click-free.
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + RAMP)
  gain.gain.setValueAtTime(PEAK_GAIN, start + duration - RAMP)
  gain.gain.linearRampToValueAtTime(0, start + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration)
}

/** 880 Hz for 120 ms, a 60 ms gap, then 1320 Hz for 180 ms (about 0.36 s). */
export function playRestChime(): void {
  try {
    const context = getContext()
    if (!context) return
    if (context.state === 'suspended') void context.resume().catch(() => {})
    const now = context.currentTime
    tone(context, 880, now, 0.12)
    tone(context, 1320, now + 0.18, 0.18)
  } catch {
    // Audio is optional.
  }
}

export function vibrateRestEnd(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([200, 100, 200])
  } catch {
    // Vibration is optional.
  }
}

/** Test-only: forget the shared context so a test can install its own fake. */
export function __resetAudioForTests() {
  audioContext = null
}
