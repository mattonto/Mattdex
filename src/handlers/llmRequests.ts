import { Hono } from 'hono';
import { z } from 'zod';
import { LLMRequestSchema, LLMResponseSchema, LLMRequest } from '../llm/types';
import { ILLMRouterService, LLMRouterService } from '../services/llmRouterService';

// Define the App type for Hono context, including environment variables if needed
type Env = {
  // Add any environment variables or bindings here if necessary
  // For this task, LLMRouterService is instantiated directly, not bound.
};

export const llmRequestsApp = new Hono<{ Bindings: Env }>();

/**
 * Handles POST /llm/chat/completions requests.
 * Validates the incoming request, calls the LLMRouterService, and formats the response.
 */
llmRequestsApp.post('/chat/completions', async (c) => {
  let requestBody: LLMRequest;
  try {
    requestBody = await c.req.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const validationResult = LLMRequestSchema.safeParse(requestBody);

  if (!validationResult.success) {
    console.warn('LLM request validation failed:', validationResult.error.errors);
    return c.json(
      {
        error: 'Validation failed',
        details: validationResult.error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      },
      422
    );
  }

  const validatedRequest = validationResult.data;
  const llmRouterService: ILLMRouterService = new LLMRouterService(); // Instantiate the service

  try {
    const completionResponse = await llmRouterService.routeAndGenerateChatCompletion(validatedRequest);
    // Ensure the response from the service also conforms to the schema
    const responseValidation = LLMResponseSchema.safeParse(completionResponse);
    if (!responseValidation.success) {
      console.error('LLMRouterService returned an invalid response:', responseValidation.error.errors);
      return c.json({ error: 'Internal server error: LLM service response malformed' }, 500);
    }
    return c.json(responseValidation.data, 200);
  } catch (error) {
    console.error('Error from LLMRouterService:', error);
    return c.json({ error: 'Internal server error during LLM completion' }, 500);
  }
});
