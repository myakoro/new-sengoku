export type BgmMode = 'main' | 'battle' | 'council' | 'none'

type TrackKey = Exclude<BgmMode, 'none'>

const TRACK_BASENAMES: Record<TrackKey, string> = {
    main: '/bgm/main',
    battle: '/bgm/battle',
    council: '/bgm/council',
}

const AUDIO_EXTS = ['mp3', 'ogg', 'wav'] as const

class BgmManager {
    private currentMode: BgmMode = 'none'
    private currentAudio: HTMLAudioElement | null = null
    private volume = 0.35
    private pendingMode: BgmMode | null = null
    private interactionHooked = false

    setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(1, volume))
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume
        }
    }

    getVolume() {
        return this.volume
    }

    getMode() {
        return this.currentMode
    }

    setMode(mode: BgmMode) {
        if (mode === this.currentMode) return

        this.stopInternal()
        this.currentMode = mode

        if (mode === 'none') return

        this.pendingMode = mode
        void this.playWithFallback(mode)
    }

    stop() {
        this.stopInternal()
        this.currentMode = 'none'
    }

    private stopInternal() {
        if (!this.currentAudio) return
        try {
            this.currentAudio.pause()
            this.currentAudio.currentTime = 0
        } catch {
            // ignore
        }
        this.currentAudio = null
    }

    private hookUserInteractionForRetry() {
        if (this.interactionHooked) return
        this.interactionHooked = true

        const handler = () => {
            if (this.pendingMode && this.pendingMode !== 'none') {
                void this.playWithFallback(this.pendingMode)
            }
        }

        // 自動再生がブロックされた場合、最初のユーザー操作で再生を再試行する
        window.addEventListener('pointerdown', handler, { once: true })
        window.addEventListener('keydown', handler, { once: true })
    }

    private async playWithFallback(mode: TrackKey): Promise<void> {
        const base = TRACK_BASENAMES[mode]
        const audio = new Audio()
        audio.loop = true
        audio.volume = this.volume

        const trySrc = async (src: string): Promise<boolean> => {
            return await new Promise((resolve) => {
                const cleanup = () => {
                    audio.removeEventListener('canplaythrough', onReady)
                    audio.removeEventListener('error', onError)
                }
                const onReady = () => {
                    cleanup()
                    resolve(true)
                }
                const onError = () => {
                    cleanup()
                    resolve(false)
                }
                audio.addEventListener('canplaythrough', onReady, { once: true })
                audio.addEventListener('error', onError, { once: true })
                audio.src = src
                audio.load()
            })
        }

        let selectedSrc: string | null = null
        for (const ext of AUDIO_EXTS) {
            const src = `${base}.${ext}`
            // eslint-disable-next-line no-await-in-loop
            const ok = await trySrc(src)
            if (ok) {
                selectedSrc = src
                break
            }
        }

        if (!selectedSrc) {
            return
        }

        // モードが変わっていたら古い再生リクエストは破棄
        if (this.currentMode !== mode) {
            return
        }

        this.currentAudio = audio
        try {
            await audio.play()
            this.pendingMode = null
            this.interactionHooked = false
        } catch {
            // 自動再生ブロック等。ユーザー操作で再試行。
            this.hookUserInteractionForRetry()
        }
    }
}

let singleton: BgmManager | null = null

export function getBgmManager(): BgmManager {
    if (!singleton) singleton = new BgmManager()
    return singleton
}
