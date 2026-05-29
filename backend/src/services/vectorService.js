import { Pinecone } from '@pinecone-database/pinecone';

export class VectorService {
  static sanitizeMetadata(metadata) {
    return Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
        return Array.isArray(value) && value.every((item) => typeof item === 'string');
      })
    );
  }

  static getNamespace(filename) {
    if (!filename) return 'default';
    return filename
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_\-]/g, '_');
  }

  static getIndex() {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME;

    if (!apiKey || !indexName) {
      throw new Error('PINECONE_API_KEY or PINECONE_INDEX_NAME is missing in backend environment variables.');
    }

    const pc = new Pinecone({ apiKey });
    return pc.index(indexName);
  }

  static async upsertVectors(chunks, embeddings) {
    if (chunks.length !== embeddings.length) {
      throw new Error('The number of chunks must match the number of generated embeddings.');
    }

    const index = this.getIndex();
    const filename = chunks[0].metadata.filename;
    const namespace = this.getNamespace(filename);
    const namespacedIndex = index.namespace(namespace);

    const records = chunks.map((chunk, idx) => ({
      id: `${namespace}_chunk_${idx}_${Date.now()}`,
      values: embeddings[idx],
      metadata: this.sanitizeMetadata({
        text: chunk.pageContent,
        filename: chunk.metadata.filename,
        chunkIndex: chunk.metadata.chunkIndex,
        charCount: chunk.metadata.charCount,
        sparseText: chunk.metadata.sparseText,
        pageNumber: chunk.metadata.pageNumber,
      }),
    }));

    try {
      console.log(`Upserting ${records.length} chunks into Pinecone namespace=${namespace}...`);
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await namespacedIndex.upsert(batch);
      }
      console.log(`Indexed ${records.length} chunks for file: ${filename}`);
    } catch (error) {
      console.error(`Pinecone upsert failed for ${filename}:`, error);
      throw new Error(`Pinecone Vector Database upsert failed: ${error.message}`);
    }
  }

  static async querySimilarChunks(queryVector, filename, topK = 5) {
    if (!queryVector || !Array.isArray(queryVector)) {
      throw new Error('Query vector is required to search Pinecone.');
    }

    const index = this.getIndex();
    const namespace = this.getNamespace(filename);
    const namespacedIndex = index.namespace(namespace);
    const queryParams = {
      vector: queryVector,
      topK,
      includeMetadata: true,
    };

    try {
      const response = await namespacedIndex.query(queryParams);

      if (!response.matches || response.matches.length === 0) {
        return [];
      }

      return response.matches.map((match) => ({
        id: `${match.metadata?.filename ?? filename}::${match.metadata?.chunkIndex ?? -1}`,
        text: match.metadata?.text || '',
        score: match.score || 0,
        filename: match.metadata?.filename || filename,
        chunkIndex: match.metadata?.chunkIndex ?? -1,
        pageNumber: match.metadata?.pageNumber ?? null,
        keywordText: match.metadata?.sparseText || '',
      }));
    } catch (error) {
      console.error(`Pinecone query failed for ${filename}:`, error);
      throw new Error(`Pinecone retrieval failed: ${error.message}`);
    }
  }

  static async querySimilarChunksAcrossFiles(queryVector, filenames, topK = 5) {
    const scopedFilenames = [...new Set((filenames || []).filter(Boolean))];
    if (scopedFilenames.length === 0) {
      return [];
    }

    const perFileTopK = Math.max(topK, Math.ceil(topK / scopedFilenames.length));
    const results = await Promise.all(
      scopedFilenames.map((filename) => this.querySimilarChunks(queryVector, filename, perFileTopK))
    );

    return results
      .flat()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, topK);
  }

  static async deleteVectorsByFilename(filename) {
    if (!filename) return;

    const index = this.getIndex();
    const namespace = this.getNamespace(filename);
    const namespacedIndex = index.namespace(namespace);

    try {
      console.log(`Deleting vectors in namespace=${namespace} for file: ${filename}`);
      await namespacedIndex.deleteMany({ filename });
      console.log(`Cleared vectors for file: ${filename}`);
    } catch (error) {
      console.error(`Failed to delete vectors for file ${filename}:`, error);
    }
  }
}
