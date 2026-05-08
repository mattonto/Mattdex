import { Message } from 'cloudflare:queues';
import { FileParseJob } from '../types';
import { parserRegistry } from '../parsing/parserRegistry';
import { astExtractor } from '../parsing/astExtractor';
import { contextWriter } from '../db/contextWriter';

export async function handleFileParse(message: Message<FileParseJob>): Promise<void> {
  const { payload } = message.body;
  const { filePath, content, language } = payload;

  try {
    // Get the appropriate parser for the language
    const parser = parserRegistry.getParser(language);
    if (!parser) {
      console.error(`No parser available for language: ${language}`);
      message.ack();
      return;
    }

    // Parse the file content into an AST
    const tree = parser.parse(content);

    // Extract meaningful symbols and dependencies from the AST
    const extracted = astExtractor.extract(tree.rootNode, content, filePath, language);

    // Write the parsed context to persistent storage via contextWriter
    await contextWriter.writeContext({
      filePath,
      language,
      symbols: extracted.symbols,
      dependencies: extracted.dependencies,
      ast: extracted.astMetadata // Optional: store simplified AST metadata
    });

    // Acknowledge successful processing
    message.ack();
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Failed to process file parse job',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      filePath,
      language,
      timestamp: new Date().toISOString()
    }));
    message.retry();
  }
}