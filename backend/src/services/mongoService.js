import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'naive_rag';
const EVALUATION_FILE = process.env.EVALUATION_DATA_FILE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/evaluation_history.json');

let cachedClient = null;
let cachedDb = null;

function isMongoEnabled() {
  return Boolean(MONGODB_URI);
}

async function ensureLocalStorage() {
  try {
    await fs.mkdir(path.dirname(EVALUATION_FILE), { recursive: true });
    try {
      await fs.access(EVALUATION_FILE);
    } catch {
      await fs.writeFile(EVALUATION_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  } catch {
    // Silently ignore on read-only / ephemeral Vercel filesystem
  }
}

async function readLocalEvaluationRecords() {
  try {
    await ensureLocalStorage();
    const raw = await fs.readFile(EVALUATION_FILE, 'utf8');
    try {
      return JSON.parse(raw) || [];
    } catch {
      return [];
    }
  } catch {
    return [];
  }
}

async function writeLocalEvaluationRecords(records) {
  try {
    await ensureLocalStorage();
    await fs.writeFile(EVALUATION_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch {
    // Silently ignore on read-only / ephemeral Vercel filesystem
  }
}

export async function getMongoDb() {
  if (cachedDb) return cachedDb;
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI environment variable for evaluation storage.');
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(MONGODB_DB);
  return cachedDb;
}

export async function getEvaluationCollection() {
  const db = await getMongoDb();
  return db.collection('evaluation_results');
}

export async function saveEvaluationRecord(record) {
  if (isMongoEnabled()) {
    const collection = await getEvaluationCollection();
    await collection.insertOne(record);
    return;
  }

  const records = await readLocalEvaluationRecords();
  records.unshift(record);
  await writeLocalEvaluationRecords(records);
}

export async function getEvaluationRecords(limit = 100) {
  if (isMongoEnabled()) {
    const collection = await getEvaluationCollection();
    return await collection.find().sort({ timestamp: -1 }).limit(limit).toArray();
  }

  const records = await readLocalEvaluationRecords();
  const sorted = records.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return sorted.slice(0, limit);
}

export async function closeMongoConnection() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
