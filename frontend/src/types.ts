
export class AiServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiServiceError";
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, AiServiceError.prototype);
  }
}

export type OperationStatus = "NOT_STARTED" | "GENERATING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "FETCHING";

export interface VideoGenerationParams {
  prompt: string;
  imageBase64?: string | null;
  mimeType?: string | null;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  durationSeconds: number;
  generateAudio: boolean;
  // Add other VEO-3 parameters as needed
  // e.g., sampleCount: number;
  // personGeneration: "allow_adult" | "strict"; 
  // addWatermark: boolean;
}

export interface VideoJobDetails extends VideoGenerationParams {
  id: string;
  operationId: string | null;
  status: OperationStatus;
  videoBase64: string | null; // Base64 encoded MP4 string
  errorMessage: string | null;
  progress?: number; // Optional progress for long running op
}