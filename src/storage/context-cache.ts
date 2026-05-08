import { SessionContext } from '../types/session';

export class ContextCache {
  private r2: R2Bucket;

  constructor(r2: R2Bucket) {
    this.r2 = r2;
  }

  private buildKey(sessionId: string): string {
    return `session/${sessionId}.json`;
  }

  private generateVersion(): number {
    return Date.now();
  }

  async read(sessionId: string): Promise<SessionContext | null> {
    const key = this.buildKey(sessionId);
    const object = await this.r2.get(key);

    if (!object) return null;

    const content = await object.json<SessionContext>();
    return content;
  }

  async write(sessionId: string, messages: Array<{ role: string; content: string }>): Promise<SessionContext> {
    const key = this.buildKey(sessionId);
    const version = this.generateVersion();
    const updatedAt = Date.now();

    const context: SessionContext = {
      sessionId,
      messages,
      version,
      updatedAt,
    };

    await this.r2.put(key, JSON.stringify(context), {
      contentType: 'application/json',
    });

    return context;
  }

  async update(
    sessionId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<SessionContext | null> {
    const existing = await this.read(sessionId);
    if (!existing) return null;

    const version = existing.version + 1;
    const updatedAt = Date.now();

    const updatedContext: SessionContext = {
      sessionId,
      messages,
      version,
      updatedAt,
    };

    await this.r2.put(
      this.buildKey(sessionId),
      JSON.stringify(updatedContext),
      { contentType: 'application/json' }
    );

    return updatedContext;
  }

  async delete(sessionId: string): Promise<boolean> {
    const key = this.buildKey(sessionId);
    try {
      await this.r2.delete(key);
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }
}
