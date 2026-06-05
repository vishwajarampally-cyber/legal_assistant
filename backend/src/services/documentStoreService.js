import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_DOCUMENTS } from '../config/defaultDocuments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'legal-assistant-data')
  : path.resolve(__dirname, '../../data');

function safeStoredName(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'document';
  return `${base}_${Date.now()}${ext}`;
}

export class DocumentStoreService {
  static getDataDir() {
    return process.env.DOCUMENT_STORE_DIR || DEFAULT_DATA_DIR;
  }

  static getUploadDir() {
    return path.join(this.getDataDir(), 'uploads');
  }

  static getManifestPath() {
    return path.join(this.getDataDir(), 'documents.json');
  }

  static async ensureStore() {
    await fs.mkdir(this.getUploadDir(), { recursive: true });
  }

  static async readManifest() {
    try {
      await this.ensureStore();
      const raw = await fs.readFile(this.getManifestPath(), 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.documents) ? parsed.documents : [];
    } catch (error) {
      if (['ENOENT', 'EROFS', 'EACCES'].includes(error.code)) return [];
      throw error;
    }
  }

  static async writeManifest(documents) {
    await this.ensureStore();
    await fs.writeFile(
      this.getManifestPath(),
      JSON.stringify({ documents }, null, 2),
      'utf8'
    );
  }

  static async saveUploadedDocument({ buffer, originalname, mimetype }) {
    if (!buffer || !originalname) {
      throw new Error('Missing uploaded document data.');
    }

    await this.ensureStore();
    const storedName = safeStoredName(originalname);
    const storedPath = path.join(this.getUploadDir(), storedName);
    await fs.writeFile(storedPath, buffer);

    return {
      filename: originalname,
      mimetype,
      storedName,
      storedPath,
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  static async upsertDocument(metadata) {
    const documents = await this.readManifest();
    const previous = documents.find((item) => item.filename === metadata.filename);
    const nextDocuments = documents.filter((item) => item.filename !== metadata.filename);

    if (previous?.storedPath && previous.storedPath !== metadata.storedPath) {
      await fs.unlink(previous.storedPath).catch(() => {});
    }

    nextDocuments.push({
      ...metadata,
      indexedAt: new Date().toISOString(),
    });

    await this.writeManifest(nextDocuments);
    return nextDocuments[nextDocuments.length - 1];
  }

  static async listDocuments() {
    const documents = await this.readManifest();
    const mergedDocuments = this.mergeDocuments(DEFAULT_DOCUMENTS, documents);

    return mergedDocuments
      .map(({ filename, mimetype, size, chunkCount, charCount, uploadedAt, indexedAt }) => ({
        filename,
        mimetype,
        size,
        chunkCount,
        charCount,
        uploadedAt,
        indexedAt,
      }))
      .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  }

  static mergeDocuments(seedDocuments, storedDocuments) {
    const byFilename = new Map();
    for (const document of seedDocuments || []) {
      if (document?.filename) byFilename.set(document.filename, document);
    }
    for (const document of storedDocuments || []) {
      if (document?.filename) byFilename.set(document.filename, document);
    }
    return [...byFilename.values()];
  }

  static async listFilenames() {
    const documents = await this.listDocuments();
    return documents.map((document) => document.filename);
  }

  static async deleteDocument(filename) {
    if (!filename) return false;

    const documents = await this.readManifest();
    const target = documents.find((item) => item.filename === filename);
    const remaining = documents.filter((item) => item.filename !== filename);

    if (target?.storedPath) {
      await fs.unlink(target.storedPath).catch(() => {});
    }

    await this.writeManifest(remaining);
    return Boolean(target);
  }
}
