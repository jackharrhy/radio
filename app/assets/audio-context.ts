export function isAudioContextPaused(
  state: AudioContextState | string | undefined | null,
): boolean {
  return state === "suspended" || state === "interrupted";
}

class AudioContextManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private connectedMedia = new WeakSet<HTMLMediaElement>();

  getContext(): AudioContext {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -24;
      this.analyser.smoothingTimeConstant = 0.78;
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.context.destination);
    }
    return this.context;
  }

  getAnalyser(): AnalyserNode {
    if (!this.analyser) this.getContext();
    return this.analyser!;
  }

  async resume(): Promise<void> {
    let context = this.getContext();
    if (isAudioContextPaused(context.state)) await context.resume();
    await this.requestWakeLock();
  }

  setMasterGain(value: number, rampTime = 0.05): void {
    let context = this.getContext();
    let gain = this.masterGain!;
    let clamped = Math.max(0, Math.min(1, value));
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
    gain.gain.linearRampToValueAtTime(clamped, context.currentTime + rampTime);
  }

  connectMediaElement(element: HTMLMediaElement): void {
    if (this.connectedMedia.has(element)) return;
    let source = this.getContext().createMediaElementSource(element);
    source.connect(this.masterGain!);
    this.connectedMedia.add(element);
  }

  private async requestWakeLock(): Promise<void> {
    if (this.wakeLock) return;
    try {
      if ("wakeLock" in navigator) {
        this.wakeLock = await navigator.wakeLock.request("screen");
        this.wakeLock.addEventListener("release", () => {
          this.wakeLock = null;
        });
      }
    } catch {
      // Best effort only.
    }
  }
}

export const audioContextManager = new AudioContextManager();
