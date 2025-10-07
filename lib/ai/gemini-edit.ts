import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import fetch from 'node-fetch';
import { appendLog } from './logger';
import type { EditIntent } from '../types/ai'

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("GEMINI_API_KEY environment variable not set. The image editing API will not work.");
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

async function urlToGenerativePart(url: string): Promise<Part> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${url}`);
  }
  const buffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  return {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType,
    },
  };
}

export async function editImageWithGemini(imageUrl: string, intent: EditIntent): Promise<{ editedImageBuffer: Buffer | null; note: string }> {
  if (!API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  try {
    await appendLog({ phase: 'gemini.edit.request', imageUrl, intent });

    // Using gemini-pro-vision as it's the standard multimodal model.
    // The API call is structured to handle an image output if the model supports it.
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const prompt = `Photo editing prompt: ${intent.instruction}. Edit the following image to apply this change. IMPORTANT: You MUST respond with ONLY the edited image, no text, conversation, or explanations. Just the final image.`;
    const imagePart = await urlToGenerativePart(imageUrl);

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;

    // Search for an image in the response parts.
    const imageParts = response.candidates?.[0]?.content?.parts.filter(part => part.inlineData && part.inlineData.mimeType.startsWith('image/'));

    if (imageParts && imageParts.length > 0) {
      const imageBuffer = Buffer.from(imageParts[0].inlineData!.data, 'base64');
      const textPart = response.text() || "Image edited successfully by Gemini.";
      await appendLog({ phase: 'gemini.edit.success', note: textPart });
      return { editedImageBuffer: imageBuffer, note: textPart };
    }

    const textResponse = response.text();
    console.error("Gemini API did not return an image. Text response:", textResponse);
    await appendLog({ phase: 'gemini.edit.no_image_response', response: textResponse });
    throw new Error(`The AI model responded with text but did not return an edited image: "${textResponse}"`);

    } catch (error: unknown) {
      console.error('Error calling Gemini API for image editing:', error);
      await appendLog({ phase: 'gemini.edit.error', error: String(error) });
      const msg = error && typeof error === 'object' && 'message' in error ? String((error as Record<string, unknown>).message) : String(error)
      return { editedImageBuffer: null, note: `Error during AI editing: ${msg}` };
    }
}
