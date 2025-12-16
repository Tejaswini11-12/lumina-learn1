import { GoogleGenAI } from "@google/genai";

// Helper to convert File to Base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateVeoVideo = async (
  imageFile: File,
  prompt: string,
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
  try {
    // 1. Initialize Client with process.env.API_KEY
    // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 2. Prepare Image
    const imageBase64 = await fileToGenerativePart(imageFile);
    
    // 3. Start Generation Operation
    console.log("Starting video generation...");
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || "Animate this image", 
      image: {
        imageBytes: imageBase64,
        mimeType: imageFile.type,
      },
      config: {
        numberOfVideos: 1,
        resolution: '1080p', // Better quality
        aspectRatio: aspectRatio
      }
    });

    // 4. Poll for completion
    console.log("Polling for completion...");
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log("Polling status:", operation.metadata); // Log metadata if available
    }

    // 5. Extract URI
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!videoUri) {
      throw new Error("No video URI returned from the API.");
    }

    // 6. Fetch the actual video bytes (requires key)
    // We must append the API key to the URI to fetch the protected content.
    // Check if the URI already has query parameters to determine the separator.
    const separator = videoUri.includes('?') ? '&' : '?';
    const authenticatedUri = `${videoUri}${separator}key=${process.env.API_KEY}`;
    
    return authenticatedUri;

  } catch (error: any) {
    console.error("Veo Generation Error:", error);
    throw error;
  }
};