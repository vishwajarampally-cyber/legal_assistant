import { Pinecone } from '@pinecone-database/pinecone';

/**
 * Service to generate text embeddings using Pinecone's native hosts and free Inference API.
 * Uses the multilingual-e5-large model which generates 1024-dimensional vectors.
 */
export class EmbeddingService {
  /**
   * Instantiates and returns the Pinecone client.
   * @returns {Pinecone}
   */
  static getPineconeClient() {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is not defined in backend environment variables.');
    }
    return new Pinecone({ apiKey });
  }

  /**
   * Generates embeddings for an array of document texts using Pinecone's inference engine.
   * @param {string[]} texts - Array of string chunks
   * @returns {Promise<number[][]>} 2D array of vectors (1024 dimensions)
   */
  static async generateEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array of strings.');
    }

    const batchSize = Number(process.env.EMBEDDING_BATCH_SIZE) || 90;
    if (texts.length > batchSize) {
      console.log(`[EMBEDDINGS] Splitting ${texts.length} chunks into batches of ${batchSize} for Pinecone inference...`);
    }

    try {
      const pc = this.getPineconeClient();
      const batches = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }

      const results = [];
      for (const [index, batch] of batches.entries()) {
        console.log(`[EMBEDDINGS] Generating Pinecone hosted inference embeddings for batch ${index + 1}/${batches.length} with ${batch.length} chunks...`);
        const response = await pc.inference.embed(
          'multilingual-e5-large',
          batch,
          { inputType: 'passage', truncate: 'END' }
        );

        if (!response || !Array.isArray(response)) {
          throw new Error('Invalid or empty response returned from Pinecone Inference API.');
        }

        results.push(...response.map((record) => record.values));
      }

      return results;
    } catch (error) {
      console.error('Error generating Pinecone embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Generates a single embedding for a user query.
   * @param {string} query - User search question
   * @returns {Promise<number[]>} 1D vector representation (1024 dimensions)
   */
  static async generateQueryEmbedding(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string.');
    }

    try {
      const pc = this.getPineconeClient();
      console.log(`[EMBEDDINGS] Generating Pinecone query embedding...`);
      
      const response = await pc.inference.embed(
        'multilingual-e5-large',
        [query],
        { inputType: 'query', truncate: 'END' }
      );

      if (!response || !Array.isArray(response) || response.length === 0) {
        throw new Error('Pinecone Inference API returned an empty response for query.');
      }

      return response[0].values;
    } catch (error) {
      console.error('Error generating Pinecone query embedding:', error);
      throw new Error(`Failed to generate query embedding: ${error.message}`);
    }
  }
}
