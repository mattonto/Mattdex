import { generateText } from 'ai';

// Infer the return type of generateText for LLMResponse
type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;

export interface LLMResponse {
  text: GenerateTextResult['text'];
  usage: GenerateTextResult['usage'];
  finishReason: GenerateTextResult['finishReason'];
}

export interface Env {
  OPENAI_API_KEY: string;
  // Add other environment variables as needed by other parts of the worker
}
