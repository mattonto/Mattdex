export interface SessionContext {
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  version: number;
  updatedAt: number;
}
