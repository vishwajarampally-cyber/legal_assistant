import { ParserService } from './parserService.js';
import { ChunkerService } from './chunkerService.js';
import { EmbeddingService } from './embeddingService.js';
import { VectorService } from './vectorService.js';
import { SparseSearchService } from './sparseSearchService.js';

export class IngestionService {
  static async ingestDocument({ buffer, originalname, mimetype }) {
    if (!buffer || !originalname) {
      throw new Error('Missing document buffer or filename during ingestion.');
    }

    const text = await ParserService.extractText(buffer, originalname, mimetype);
    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new Error('Uploaded document contains no extractable text.');
    }

    const chunks = await ChunkerService.splitText(normalizedText, {
      metadata: { filename: originalname },
      chunkSize: Number(process.env.CHUNK_SIZE) || 64,
      chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 12,
    });

    const enrichedChunks = SparseSearchService.attachSparseMetadata(chunks);
    const texts = enrichedChunks.map((chunk) => chunk.pageContent);
    const embeddings = await EmbeddingService.generateEmbeddings(texts);

    await VectorService.deleteVectorsByFilename(originalname);
    await VectorService.upsertVectors(enrichedChunks, embeddings);

    return {
      filename: originalname,
      chunkCount: enrichedChunks.length,
      charCount: normalizedText.length,
      message: 'Document parsed and indexed in vector database successfully.',
    };
  }
}
