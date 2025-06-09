import { GoogleGenAI } from '@google/genai';
import Speaker from 'speaker';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

// MODIFIED: Function now handles streaming audio playback.
async function generateAndPlayAudioStream(textToSpeak) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

  const speaker = new Speaker({
    channels: 1,        // 1 channel (mono)
    bitDepth: 16,       // 16-bit samples
    sampleRate: 24000,  // 24,000 Hz sample rate
  });

  speaker.on('error', (err) => {
      console.error("Speaker error:", err);
  });
  
  try {
    console.log("Requesting audio stream...");
    
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-preview-tts",
      contents: textToSpeak,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { voiceName: 'Puck' },
        },
      },
    });

    console.log("Audio stream started. Piping to speaker...");

    var i = 0
    for await (const chunk of response) {
      // console.log(JSON.stringify(chunk))
      console.log("Chunk: " + i++)
      const audioChunk = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (audioChunk) {
        const audioChunkBuffer = Buffer.from(audioChunk, 'base64');
        speaker.write(audioChunkBuffer);
      }
    }

    console.log("Stream finished.");
    
  } catch(error) {
    console.error("Error during streaming:", error);
    throw error;
  } finally {
    console.log('Closing the speaker.')
    speaker.end();
  }
}

app.post('/generate-speech', async (req, res) => {
  try {
    const text = req.body.text;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required.' });
    }
    
    console.log(`Streaming audio for: "${text}"`);
    // The 'await' here will now wait for the *entire stream* to be processed and played.
    await generateAndPlayAudioStream(text);
    
    res.json({ success: true, message: 'Audio streamed and played on server successfully.' });

  } catch (error) {
    console.error("Error in /generate-speech endpoint:", error.message);
    res.status(500).json({ success: false, message: 'Failed to play audio.' });
  }
});

// --- Start the server ---
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});