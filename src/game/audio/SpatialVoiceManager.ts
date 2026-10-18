import * as THREE from 'three';
import type { NetworkClient } from '../network/NetworkClient';
import type {
  VoiceRelayPayload,
  VoicePeerMutePayload,
  VoicePeerNotificationPayload,
} from '../network/networkProtocol';

export const VOICE_INNER_RADIUS = 2.0;
export const VOICE_OUTER_RADIUS = 50.0;

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Oblicza współczynnik tłumienia głośności przestrzennej (0..1)
 * zgodnie ze specyfikacją gry (pełny głos do 2m, kwadratowy spadek do 50m, 0 powyżej 50m).
 */
export function computeVoiceSpatialGain(
  distance: number,
  isMuted: boolean,
  userVolume = 1.0,
  innerRadius = VOICE_INNER_RADIUS,
  outerRadius = VOICE_OUTER_RADIUS,
): number {
  if (isMuted || userVolume <= 0) return 0;
  if (distance <= innerRadius) return THREE.MathUtils.clamp(userVolume, 0, 1);
  if (distance >= outerRadius) return 0;
  const ratio = 1 - (distance - innerRadius) / (outerRadius - innerRadius);
  return ratio * ratio * THREE.MathUtils.clamp(userVolume, 0, 1);
}

/**
 * Oblicza panoramę stereo (-1..1) dla źródła dźwięku względem pozycji i orientacji słuchacza (yaw).
 */
export function computeVoiceStereoPan(
  listenerPos: { x: number; z: number },
  listenerYaw: number,
  sourcePos: { x: number; z: number },
): number {
  const dx = sourcePos.x - listenerPos.x;
  const dz = sourcePos.z - listenerPos.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return 0;

  // Wektor w prawo słuchacza w układzie współrzędnych Three.js:
  // Kamera patrzy w kierunku: (-sin(yaw), 0, -cos(yaw))
  // Wektor w prawo kamery: (cos(yaw), 0, -sin(yaw))
  const rightX = Math.cos(listenerYaw);
  const rightZ = -Math.sin(listenerYaw);

  const dot = (dx * rightX + dz * rightZ) / len;
  return THREE.MathUtils.clamp(dot, -1, 1);
}

/**
 * Oblicza wartość skuteczną (RMS) dla bufora próbek audio Float32Array (-1.0..1.0).
 */
export function computeVoiceRms(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const val = buffer[i];
    sum += val * val;
  }
  return Math.sqrt(sum / buffer.length);
}

export const DEFAULT_SPEAKING_RMS_THRESHOLD = 0.015;

export type MicState = 'off' | 'requesting' | 'active' | 'muted' | 'denied' | 'unsupported';

interface RemotePeerAudio {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  sourceNode?: MediaStreamAudioSourceNode;
  gainNode?: GainNode;
  pannerNode?: StereoPannerNode;
  analyserNode?: AnalyserNode;
  audioElement?: HTMLAudioElement;
  isMuted: boolean;
  isSpeaking: boolean;
  distance: number;
}

export interface SpatialVoiceManagerOptions {
  networkClient?: NetworkClient;
  autoRequestMic?: boolean;
  userVolume?: number;
  onMicStateChange?: (state: MicState) => void;
  onSpeakingChange?: (peerId: string, isSpeaking: boolean) => void;
  onSpeakingPeersChange?: (speakingPeerIds: Set<string>) => void;
  speakingThreshold?: number;
}

export class SpatialVoiceManager {
  private audioContext?: AudioContext;
  private localStream?: MediaStream;
  private micState: MicState = 'off';
  private userMuted = false;
  private userVolume = 1.0;
  private peers = new Map<string, RemotePeerAudio>();
  private unsubscribers: Array<() => void> = [];
  private disposed = false;

  private readonly onMicStateChange?: (state: MicState) => void;
  private readonly onSpeakingChange?: (peerId: string, isSpeaking: boolean) => void;
  private readonly onSpeakingPeersChangeOption?: (speakingPeerIds: Set<string>) => void;
  private speakingThreshold: number;
  private speakingCallbacks = new Set<(speakingPeers: Set<string>) => void>();
  private peerSpeakingCallbacks = new Set<(peerId: string, isSpeaking: boolean) => void>();
  private rmsBuffer?: Float32Array;

  constructor(
    private readonly networkClient?: NetworkClient,
    options: SpatialVoiceManagerOptions = {},
  ) {
    this.userVolume = options.userVolume ?? 1.0;
    this.onMicStateChange = options.onMicStateChange;
    this.onSpeakingChange = options.onSpeakingChange;
    this.onSpeakingPeersChangeOption = options.onSpeakingPeersChange;
    this.speakingThreshold = options.speakingThreshold ?? DEFAULT_SPEAKING_RMS_THRESHOLD;

    if (this.networkClient) {
      this.setupNetworkHandlers(this.networkClient);
    }

    if (options.autoRequestMic) {
      void this.requestMicrophone();
    }
  }

  private getOrCreateAudioContext(): AudioContext | undefined {
    if (typeof window === 'undefined') return undefined;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return undefined;

    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private setupNetworkHandlers(client: NetworkClient): void {
    this.unsubscribers.push(
      client.onVoiceSignal((payload: VoiceRelayPayload) => {
        void this.handleIncomingSignal(payload);
      }),
      client.onVoicePeerMute((payload: VoicePeerMutePayload) => {
        this.handlePeerMute(payload);
      }),
      client.onVoicePeerJoined((payload: VoicePeerNotificationPayload) => {
        this.handlePeerJoined(payload.peerId);
      }),
      client.onVoicePeerLeft((payload: VoicePeerNotificationPayload) => {
        this.handlePeerLeft(payload.peerId);
      }),
    );
  }

  /**
   * Zgłasza prośbę do przeglądarki o dostęp do mikrofonu (getUserMedia).
   * Zgodnie ze specyfikacją odmowa nie blokuje wejścia do gry.
   */
  async requestMicrophone(): Promise<boolean> {
    if (this.disposed || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.setMicState('unsupported');
      return false;
    }

    this.setMicState('requesting');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.getOrCreateAudioContext();

      // Dodanie ścieżek audio do istniejących połączeń peer:
      const audioTracks = this.localStream.getAudioTracks();
      for (const peer of this.peers.values()) {
        for (const track of audioTracks) {
          peer.connection.addTrack(track, this.localStream);
        }
      }

      this.userMuted = false;
      this.setMicState('active');
      this.networkClient?.sendVoiceMute(false);
      return true;
    } catch {
      this.setMicState('denied');
      return false;
    }
  }

  /**
   * Przełącza wyciszenie lokalnego mikrofonu (mute / unmute).
   */
  toggleMute(): boolean {
    if (!this.localStream) {
      // Jeśli mikrofon nie był jeszcze autoryzowany, spróbuj go poprosić:
      void this.requestMicrophone();
      return true;
    }

    return this.setMute(!this.userMuted);
  }

  /**
   * Ustawia jawnie stan wyciszenia lokalnego mikrofonu.
   */
  setMute(mute: boolean): boolean {
    this.userMuted = mute;

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !mute;
      }
    }

    if (this.micState === 'active' || this.micState === 'muted') {
      this.setMicState(mute ? 'muted' : 'active');
    }

    this.networkClient?.sendVoiceMute(mute);
    return this.userMuted;
  }

  isMuted(): boolean {
    return this.userMuted;
  }

  getMicState(): MicState {
    return this.micState;
  }

  setUserVolume(volume: number): void {
    this.userVolume = THREE.MathUtils.clamp(volume, 0, 1);
  }

  private setMicState(next: MicState): void {
    this.micState = next;
    this.onMicStateChange?.(next);
  }

  private handlePeerJoined(peerId: string): void {
    if (this.disposed || !this.networkClient) return;
    const myId = this.networkClient.getMyPlayerId();
    if (!myId || peerId === myId) return;

    // Tworzymy połączenie z nowym graczem (jako inicjator oferty):
    this.getOrCreatePeer(peerId, true);
  }

  private handlePeerLeft(peerId: string): void {
    this.removePeer(peerId);
  }

  private handlePeerMute(payload: VoicePeerMutePayload): void {
    const peer = this.peers.get(payload.peerId);
    if (peer) {
      peer.isMuted = payload.isMuted;
      if (peer.gainNode) {
        peer.gainNode.gain.value = computeVoiceSpatialGain(peer.distance, peer.isMuted, this.userVolume);
      }
      if (peer.isMuted && peer.isSpeaking) {
        peer.isSpeaking = false;
        this.notifyPeerSpeaking(payload.peerId, false);
        this.notifySpeakingPeers();
      }
    }
  }

  private getOrCreatePeer(peerId: string, shouldCreateOffer = false): RemotePeerAudio {
    let peer = this.peers.get(peerId);
    if (peer) return peer;

    let connection: RTCPeerConnection;
    if (typeof RTCPeerConnection !== 'undefined') {
      connection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
      });
    } else {
      connection = {
        close: () => {},
        addTrack: () => {},
        createOffer: async () => ({}),
        setLocalDescription: async () => {},
        setRemoteDescription: async () => {},
        createAnswer: async () => ({}),
        addIceCandidate: async () => {},
      } as unknown as RTCPeerConnection;
    }

    peer = {
      peerId,
      connection,
      isMuted: false,
      isSpeaking: false,
      distance: 100,
    };
    this.peers.set(peerId, peer);

    // Wysyłanie kandydatów ICE do drugiego peera:
    connection.onicecandidate = (event) => {
      if (event.candidate && this.networkClient) {
        this.networkClient.sendVoiceSignal(peerId, event.candidate.toJSON());
      }
    };

    // Obsługa przychodzącego strumienia audio:
    connection.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.attachRemoteAudioStream(peer!, stream);
    };

    // Dodanie lokalnego strumienia, jeśli jest dostępny:
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        connection.addTrack(track, this.localStream);
      }
    }

    if (shouldCreateOffer) {
      void (async () => {
        try {
          const offer = await connection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
          });
          await connection.setLocalDescription(offer);
          this.networkClient?.sendVoiceSignal(peerId, connection.localDescription?.toJSON());
        } catch {
          // Błąd negocjacji oferty
        }
      })();
    }

    return peer;
  }

  private async handleIncomingSignal(payload: VoiceRelayPayload): Promise<void> {
    const { senderPeerId, signal } = payload;
    if (!signal || !senderPeerId || this.disposed) return;

    const sig = signal as { type?: string; candidate?: string };
    const peer = this.getOrCreatePeer(senderPeerId, false);

    try {
      if (sig.type === 'offer') {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(sig as RTCSessionDescriptionInit),
        );
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        this.networkClient?.sendVoiceSignal(senderPeerId, peer.connection.localDescription?.toJSON());
      } else if (sig.type === 'answer') {
        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(sig as RTCSessionDescriptionInit),
        );
      } else if ('candidate' in sig && sig.candidate) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(sig as RTCIceCandidateInit));
      }
    } catch {
      // Ignorujemy błędy sygnału SDP/ICE
    }
  }

  private attachRemoteAudioStream(peer: RemotePeerAudio, stream: MediaStream): void {
    peer.stream = stream;
    const ctx = this.getOrCreateAudioContext();

    if (ctx) {
      try {
        const sourceNode = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0; // Początkowo wyciszony do czasu pierwszego pomiaru odległości

        let analyserNode: AnalyserNode | undefined;
        if (typeof ctx.createAnalyser === 'function') {
          analyserNode = ctx.createAnalyser();
          analyserNode.fftSize = 256;
          analyserNode.smoothingTimeConstant = 0.2;
          sourceNode.connect(analyserNode);
        }

        let pannerNode: StereoPannerNode | undefined;
        if (typeof ctx.createStereoPanner === 'function') {
          pannerNode = ctx.createStereoPanner();
          sourceNode.connect(gainNode);
          gainNode.connect(pannerNode);
          pannerNode.connect(ctx.destination);
        } else {
          sourceNode.connect(gainNode);
          gainNode.connect(ctx.destination);
        }

        peer.sourceNode = sourceNode;
        peer.gainNode = gainNode;
        peer.pannerNode = pannerNode;
        peer.analyserNode = analyserNode;
      } catch {
        // Fallback jeśli Web Audio nie może podłączyć strumienia
      }
    }

    // Element HTMLAudioElement w tle jako fallback gwarantujący utrzymanie aktywnego odtwarzania przez silnik przeglądarki:
    if (typeof document !== 'undefined') {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.muted = Boolean(ctx); // Jeśli mamy Web Audio, wyciszamy element DOM, aby dźwięk nie dublował się
      audio.srcObject = stream;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      peer.audioElement = audio;
    }
  }

  /**
   * Zwraca informację, czy dany zdalny peer obecnie mówi.
   */
  isPeerSpeaking(peerId: string): boolean {
    return this.peers.get(peerId)?.isSpeaking ?? false;
  }

  /**
   * Zwraca zbiór identyfikatorów peerów, którzy obecnie mówią.
   */
  getSpeakingPeers(): Set<string> {
    const result = new Set<string>();
    for (const [id, peer] of this.peers) {
      if (peer.isSpeaking) result.add(id);
    }
    return result;
  }

  /**
   * Ustawia jawnie stan mówienia dla peera (używane w testach lub zdarzeniach sieciowych).
   */
  setPeerSpeaking(peerId: string, isSpeaking: boolean): void {
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = this.getOrCreatePeer(peerId, false);
    }
    const val = Boolean(isSpeaking);
    if (peer.isSpeaking !== val) {
      peer.isSpeaking = val;
      this.notifyPeerSpeaking(peerId, val);
      this.notifySpeakingPeers();
    }
  }

  /**
   * Rejestruje callback informujący o zmianie zbioru mówiących peerów.
   */
  onSpeakingPeersChange(callback: (speakingPeers: Set<string>) => void): () => void {
    this.speakingCallbacks.add(callback);
    return () => this.speakingCallbacks.delete(callback);
  }

  /**
   * Rejestruje callback informujący o zmianie stanu mówienia konkretnego peera.
   */
  onPeerSpeakingChange(callback: (peerId: string, isSpeaking: boolean) => void): () => void {
    this.peerSpeakingCallbacks.add(callback);
    return () => this.peerSpeakingCallbacks.delete(callback);
  }

  private notifyPeerSpeaking(peerId: string, isSpeaking: boolean): void {
    this.onSpeakingChange?.(peerId, isSpeaking);
    for (const cb of this.peerSpeakingCallbacks) {
      try {
        cb(peerId, isSpeaking);
      } catch {
        // ignore
      }
    }
  }

  private notifySpeakingPeers(): void {
    const speaking = this.getSpeakingPeers();
    this.onSpeakingPeersChangeOption?.(speaking);
    for (const cb of this.speakingCallbacks) {
      try {
        cb(speaking);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Aktualizuje pozycje przestrzenne, głośność oraz stan mówienia zdalnych graczy w pętli renderowania gry.
   */
  update(listenerPos: Vector3Like, listenerYaw: number, remotePositions: Map<string, Vector3Like>): void {
    if (this.disposed) return;

    let speakingPeersChanged = false;

    for (const [peerId, peer] of this.peers.entries()) {
      // Detekcja mówienia RMS ze strumienia mikrofonowego:
      if (peer.analyserNode && !peer.isMuted) {
        if (!this.rmsBuffer || this.rmsBuffer.length !== peer.analyserNode.fftSize) {
          this.rmsBuffer = new Float32Array(peer.analyserNode.fftSize);
        }
        if (typeof peer.analyserNode.getFloatTimeDomainData === 'function') {
          peer.analyserNode.getFloatTimeDomainData(this.rmsBuffer as any);
          const rms = computeVoiceRms(this.rmsBuffer);
          const isSpeakingNow = rms > this.speakingThreshold;
          if (peer.isSpeaking !== isSpeakingNow) {
            peer.isSpeaking = isSpeakingNow;
            speakingPeersChanged = true;
            this.notifyPeerSpeaking(peerId, isSpeakingNow);
          }
        }
      } else if (peer.isSpeaking && peer.isMuted) {
        peer.isSpeaking = false;
        speakingPeersChanged = true;
        this.notifyPeerSpeaking(peerId, false);
      }

      const pos = remotePositions.get(peerId);
      if (!pos) {
        // Gracz poza zasięgiem snapshotu lub brak danych o pozycji:
        if (peer.gainNode) peer.gainNode.gain.value = 0;
        continue;
      }

      const dx = pos.x - listenerPos.x;
      const dy = pos.y - listenerPos.y;
      const dz = pos.z - listenerPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      peer.distance = distance;

      const gain = computeVoiceSpatialGain(distance, peer.isMuted, this.userVolume);
      if (peer.gainNode) {
        peer.gainNode.gain.value = gain;
      }

      if (peer.pannerNode) {
        const pan = computeVoiceStereoPan(listenerPos, listenerYaw, pos);
        peer.pannerNode.pan.value = pan;
      }
    }

    if (speakingPeersChanged) {
      this.notifySpeakingPeers();
    }
  }

  private removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const wasSpeaking = peer.isSpeaking;

    peer.connection.close();
    peer.sourceNode?.disconnect();
    peer.gainNode?.disconnect();
    peer.pannerNode?.disconnect();
    peer.analyserNode?.disconnect();

    if (peer.audioElement) {
      peer.audioElement.srcObject = null;
      peer.audioElement.remove();
    }

    this.peers.delete(peerId);

    if (wasSpeaking) {
      this.notifyPeerSpeaking(peerId, false);
      this.notifySpeakingPeers();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;

    for (const peerId of Array.from(this.peers.keys())) {
      this.removePeer(peerId);
    }

    this.speakingCallbacks.clear();
    this.peerSpeakingCallbacks.clear();

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop();
      this.localStream = undefined;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = undefined;
    }

    this.setMicState('off');
  }
}
