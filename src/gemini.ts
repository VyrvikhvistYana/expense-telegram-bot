import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { config } from "./config.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/** Порядок: сначала стабильные. 3.8 часто 503; 2.5 для новых ключей уже 404. */
const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL?.trim(),
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
].filter((m): m is string => Boolean(m));

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 503 || status === 429 || status === 404;
}

export function getGeminiModel(modelName: string): GenerativeModel {
  return genAI.getGenerativeModel({ model: modelName });
}

export async function generateWithFallback(
  buildRequest: (model: GenerativeModel) => Promise<{ response: { text: () => string } }>,
): Promise<string> {
  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = getGeminiModel(modelName);
      const result = await buildRequest(model);
      return result.response.text().trim();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw err;
      console.warn(`Gemini model ${modelName} failed, trying next…`, (err as Error).message);
    }
  }

  throw lastError;
}
