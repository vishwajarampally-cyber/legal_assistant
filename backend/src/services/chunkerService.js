import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * Service to chunk large document texts into manageable overlapping segments
 * for optimal embedding generation and contextual similarity search.
 */
export class ChunkerService {
  /**
   * Splits a raw string of text into structured chunks.
   * @param {string} text - Raw document text content
  * @param {Object} options - Custom controls
  * @param {number} [options.chunkSize=300] - Characters per chunk
  * @param {number} [options.chunkOverlap=50] - Overlapping character boundary
   * @param {Object} [options.metadata={}] - Base metadata (e.g. filename) to attach to each chunk
   * @returns {Promise<Array<{pageContent: string, metadata: Object}>>} List of structured document chunks
   */
  static async splitText(text, options = {}) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string to split.');
    }

    // Allow overriding via options or environment variables
    const envChunkSize = process.env.CHUNK_SIZE ? Number(process.env.CHUNK_SIZE) : undefined;
    const envChunkOverlap = process.env.CHUNK_OVERLAP ? Number(process.env.CHUNK_OVERLAP) : undefined;

    const chunkSize = options.chunkSize || envChunkSize || 64;
    const chunkOverlap = options.chunkOverlap || envChunkOverlap || 12;
    const baseMetadata = options.metadata || {};

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    // Create LangChain documents
    const rawChunks = await splitter.createDocuments([text]);

    // Map documents to plain objects for transfer/storage
    return rawChunks.map((chunk, index) => ({
      pageContent: chunk.pageContent,
      metadata: {
        ...baseMetadata,
        chunkIndex: index,
        charCount: chunk.pageContent.length,
      },
    }));
  }
}
