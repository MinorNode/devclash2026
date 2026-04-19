import axios from 'axios';
import { Readable } from 'stream';

const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const BASE_URL = "https://api.assemblyai.com";

export async function transcribeAudio(buffer, label) {
  try {
    if (!buffer || buffer.length < 1000) {
      console.warn("[STT] Skipping small/empty audio chunk");
      return "";
    }

    console.log("[STT] Uploading via stream, size:", buffer.length);

    const stream = Readable.from(buffer);

    // STEP 1 — Upload audio via stream
    const uploadRes = await axios.post(
      `${BASE_URL}/v2/upload`,
      stream,
      {
        headers: {
          authorization: ASSEMBLY_API_KEY,
          "content-type": "application/octet-stream"
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const audioUrl = uploadRes.data.upload_url;

    // STEP 2 — Request transcription
    console.log("[STT CONFIG] Using English model");
    console.log("[STT] Sending transcript request to AssemblyAI");
    const transcriptRes = await axios.post(
      `${BASE_URL}/v2/transcript`,
      {
        audio_url: audioUrl,
        language_code: "en",
        speech_models: ["universal-2"],
        punctuate: true,
        format_text: true
      },
      {
        headers: {
          authorization: ASSEMBLY_API_KEY,
          "content-type": "application/json"
        }
      }
    );

    const transcriptId = transcriptRes.data.id;
    console.log("[STT] Transcript ID:", transcriptId);

    // STEP 3 — Poll for result
    const pollingUrl = `${BASE_URL}/v2/transcript/${transcriptId}`;
    let text = "";

    while (true) {
      const pollRes = await axios.get(pollingUrl, {
        headers: { authorization: ASSEMBLY_API_KEY }
      });

      const data = pollRes.data;

      if (data.status === "completed") {
        text = data.text || "";
        break;
      }

      if (data.status === "error") {
        console.error("[STT ERROR]", data.error);
        break;
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    // STEP 4 — Return result
    console.log(`[STT][${label}] chars:`, text.length);
    return text;

  } catch (err) {
    console.error(`[STT][${label}] error:`, err);
    return "";
  }
}
