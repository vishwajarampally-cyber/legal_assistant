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

    console.log(`[INGESTION] Starting for: ${originalname}`);

    try {
      console.log(`[INGESTION] Extracting text from: ${originalname}`);
      const text = await ParserService.extractText(buffer, originalname, mimetype);
      console.log(`[INGESTION] Extracted ${text.length} characters`);
      
      const normalizedText = text.trim();
      if (!normalizedText) {
        throw new Error('Uploaded document contains no extractable text.');
      }

      console.log(`[INGESTION] Chunking text for: ${originalname}`);
      const chunks = await ChunkerService.splitText(normalizedText, {
        metadata: { filename: originalname },
        chunkSize: Number(process.env.CHUNK_SIZE) || 64,
        chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 12,
      });
      console.log(`[INGESTION] Created ${chunks.length} chunks`);

      console.log(`[INGESTION] Attaching sparse metadata for: ${originalname}`);
      const enrichedChunks = SparseSearchService.attachSparseMetadata(chunks);
      
      const texts = enrichedChunks.map((chunk) => chunk.pageContent);
      
      console.log(`[INGESTION] Generating embeddings for ${texts.length} chunks...`);
      const embeddings = await EmbeddingService.generateEmbeddings(texts);
      console.log(`[INGESTION] Generated ${embeddings.length} embeddings`);

      console.log(`[INGESTION] Deleting old vectors for: ${originalname}`);
      await VectorService.deleteVectorsByFilename(originalname);
      
      console.log(`[INGESTION] Upserting ${enrichedChunks.length} vectors...`);
      await VectorService.upsertVectors(enrichedChunks, embeddings);
      console.log(`[INGESTION] ✓ Successfully indexed: ${originalname}`);

      return {
        filename: originalname,
        chunkCount: enrichedChunks.length,
        charCount: normalizedText.length,
        message: 'Document parsed and indexed in vector database successfully.',
      };
    } catch (error) {
      console.error(`[INGESTION ERROR] Failed for ${originalname}:`, error);
      throw error;
    }
  }
}
