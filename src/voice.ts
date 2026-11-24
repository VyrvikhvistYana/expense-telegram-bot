import { generateWithFallback } from "./gemini.js";

export async function transcribeVoice(buffer: Buffer, mimeType: string): Promise<string> {
  return generateWithFallback((model) =>
    model.generateContent([
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType,
        },
      },
      {
        text: "Transcribe this voice message. Return only the spoken text, no commentary. Language may be Russian or English.",
      },
    ]),
  );
}
