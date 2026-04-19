export default class MicPipeline {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunkCallback = null;
    this.chunks = [];          // full recording
    this.liveChunks = [];      // sliding window
    this.firstChunk = null;    // header chunk
  }

  setChunkCallback(fn) {
    this.chunkCallback = fn;
  }

  async start() {
    try {
      this.chunks = []; 
      this.liveChunks = [];
      this.firstChunk = null;

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm'
      });

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const blob = event.data;
          
          this.chunks.push(blob);

          if (!this.firstChunk) {
            this.firstChunk = blob;
          }

          this.liveChunks.push(blob);

          // keep only last 2 chunks (besides first)
          if (this.liveChunks.length > 2) {
            this.liveChunks.shift();
          }

          if (this.chunkCallback) {
            this.chunkCallback(blob, 'mic');
          }
        }
      };

      // Chunk every 2500ms
      this.recorder.start(2500);
      console.log("[MicPipeline] Started recording with sliding window");
    } catch (err) {
      console.error("[MicPipeline] Error starting:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw "Microphone permission denied";
      }
      throw err;
    }
  }

  stop() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    console.log("[MicPipeline] Stopped");
  }

  getLiveBlob() {
    const combined = [this.firstChunk, ...this.liveChunks];
    return new Blob(combined, { type: 'audio/webm' });
  }

  getFullAudioBlob() {
    return new Blob(this.chunks, { type: 'audio/webm' });
  }
}
