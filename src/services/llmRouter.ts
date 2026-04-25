import { DrizzleD1Database } from 'drizzle-orm/d1';
import { generateText } from 'ai';
import { LLMRequest, LLMResponse, ModelPack, Env } from '../types';
import { modelPacks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { LLMProviderFactory } from './llmProviderFactory';

export class LLMRouterService {
  private db: DrizzleD1Database;
  private env: Env;

  constructor(db: DrizzleD1Database, env: Env) {
    this.db = db;
    this.env = env;
  }

  public async routeRequest(request: LLMRequest): Promise<LLMResponse> {
    // AC: Router retrieves model pack correctly
    const modelPack: ModelPack | undefined = await this.db.query.modelPacks.findFirst({
      where: eq(modelPacks.id, request.modelPackId),
    });

    if (!modelPack) {
      throw new Error(`Model pack with ID ${request.modelPackId} not found.`);
    }

    // AC: Router selects correct provider based on pack
    const llmClient = LLMProviderFactory.create(modelPack, this.env);

    const finalMaxTokens = request.maxTokens ?? modelPack.maxTokens;
    const finalTemperature = request.temperature ?? modelPack.temperature;
    const finalSystemPrompt = request.systemPrompt ?? ''; // Default to empty string if not provided

    // AC: Router forwards request to provider
    const { text, usage, finishReason } = await generateText({
      model: llmClient,
      system: finalSystemPrompt,
      prompt: request.prompt,
      maxTokens: finalMaxTokens,
      temperature: finalTemperature,
    });

    return {
      text,
      usage: { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens },
      finishReason,
    };
  }
}
