export default class TabPipeline {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunkCallback = null;
    this.chunks = []; // Full recording of tab (video + audio)
  }

  setChunkCallback(fn) {
    this.chunkCallback = fn;
  }

  async start() {
    try {
      this.chunks = [];
      
      // Request display media (tab sharing)
      // Note: User must check "Share tab audio" in the browser picker for audio to be included
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: {
          displaySurface: "browser",
        },
      });

      this.recorder = new MediaRecorder(this.stream, {
        mimeType: 'video/webm; codecs=vp8,opus'
      });

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const blob = event.data;
          this.chunks.push(blob);
          
          if (this.chunkCallback) {
            this.chunkCallback(blob, 'tab');
          }
        }
      };

      // Chunk every 4000ms for video
      this.recorder.start(4000);
      console.log("[TabPipeline] Started screen/tab capture");

      // Handle stream end (user clicks "Stop sharing" in browser)
      this.stream.getVideoTracks()[0].onended = () => {
        console.log("[TabPipeline] User stopped sharing via browser UI");
        this.stop();
      };

    } catch (err) {
      console.error("[TabPipeline] Error starting:", err);
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
    console.log("[TabPipeline] Stopped");
  }

  getFullVideoBlob() {
    return new Blob(this.chunks, { type: 'video/webm' });
  }
}
