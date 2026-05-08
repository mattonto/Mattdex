/**
 * Role defines the purpose of a model pack.
 * Each role corresponds to a category of tasks the model is optimized for.
 */
export enum Role {
  /**
   * 'chat' models are optimized for conversational tasks.
   */
  Chat = 'chat',

  /**
   * 'code' models are optimized for code generation and understanding.
   */
  Code = 'code',

  /**
   * 'reasoning' models are optimized for logical inference and complex problem solving.
   */
  Reasoning = 'reasoning',
}

/**
 * ModelPack maps each Role to an array of model identifiers.
 * This allows multiple models to be available for each role, enabling fallback and load balancing.
 */
export type ModelPack = {
  [Role.Chat]: string[];
  [Role.Code]: string[];
  [Role.Reasoning]: string[];
};