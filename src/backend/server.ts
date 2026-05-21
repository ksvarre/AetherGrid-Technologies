import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { parserService } from './services/parser';
import { INLPEngine, OfflineNLPEngine, GeminiNLPEngine, DocumentChunk } from './services/nlp';
import { routingService } from './services/routing';
import { dbService } from './services/database';

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Document memory index
let documentIndex: DocumentChunk[] = [];
let nlpEngine: INLPEngine;

// Initialize the NLP Engine Strategy (Decision 2 & Guideline 3)
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
  console.log("⚡ Starting AetherGrid Knowledge API in Enterprise Cloud Mode (Gemini RAG).");
  nlpEngine = new GeminiNLPEngine(apiKey);
} else {
  console.log("🔌 GEMINI_API_KEY missing or empty in .env. Starting in local Offline Mode (TF-IDF Indexer).");
  nlpEngine = new OfflineNLPEngine();
}

/**
 * Perform initial ingestion upon booting, ensuring the database is instantly ready.
 */
async function injectResolvedCorrections() {
  try {
    const feedbackList = await dbService.getFeedback();
    const resolvedCorrections = feedbackList.filter(f => f.resolved && f.correctedAnswer && f.correctedAnswer.trim() !== '');
    
    let injectCount = 0;
    resolvedCorrections.forEach(item => {
      const chunkId = `virtual_fb_${item.id}`;
      const newChunk: DocumentChunk = {
        id: chunkId,
        filePath: `virtual/correction/${item.id}`,
        fileName: `virtual_correction_${item.id}`,
        fileType: 'transcript',
        content: item.correctedAnswer!.trim(),
        author: 'System Operator (Approved)',
        attendees: [],
        date: item.timestamp ? item.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
        domain: item.domain || 'General',
        priority: 'High'
      };

      const existingIdx = documentIndex.findIndex(c => c.id === chunkId);
      if (existingIdx > -1) {
        documentIndex[existingIdx] = newChunk;
      } else {
        documentIndex.push(newChunk);
      }
      injectCount++;
    });
    if (injectCount > 0) {
      console.log(`⚡ Self-healing: Re-injected ${injectCount} resolved corrections into memory index.`);
    }
  } catch (err) {
    console.error("❌ Failed to inject resolved corrections:", err);
  }
}

async function bootstrapIndex() {
  try {
    console.log("🔍 Scanning and ingesting local synthetic corpus...");
    documentIndex = await parserService.ingestAll();
    await injectResolvedCorrections();
    console.log(`✅ Ingestion complete. Indexed ${documentIndex.length} semantic text chunks across all transcripts and office documents.`);
  } catch (err) {
    console.error("❌ Failed initial bootstrap ingestion:", err);
  }
}

// ---------------------------------------------------------------------
// API ROUTING SURFACE
// ---------------------------------------------------------------------

/**
 * GET /api/status - Core health check
 */
app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    mode: apiKey ? "Enterprise Cloud" : "Offline Fallback",
    chunksIndexed: documentIndex.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/ingest - Manual re-trigger of filesystem scanning
 */
app.post('/api/ingest', async (req, res) => {
  try {
    console.log("🔄 Re-scanning data folders by operator request...");
    documentIndex = await parserService.ingestAll();
    await injectResolvedCorrections();
    res.json({
      success: true,
      message: `Re-indexed workspace successfully.`,
      count: documentIndex.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/query - Natural language semantic search
 */
app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: "Query parameter is required and must be a string." });
  }

  try {
    if (documentIndex.length === 0) {
      return res.json({
        answer: "The knowledge index is empty. Please run data generation and ingest files first.",
        confidenceScore: 0,
        citations: [],
        domain: 'General',
        priority: 'Low'
      });
    }

    // Run strategy search query
    const result = await nlpEngine.queryDocuments(query, documentIndex);

    // If search confidence is low (< 0.40), append the Low-Confidence suggested routing (Exercise 2)
    if (result.confidenceScore < 0.40) {
      console.log(`⚠️ Low confidence search result (${result.confidenceScore}). Invoking routing generator.`);
      result.suggestedRouting = routingService.generateRouting(query, result.domain);
    }

    res.json(result);
  } catch (err: any) {
    console.error("Query API execution error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/feedback - Submits user corrections or query rejections
 */
app.post('/api/feedback', async (req, res) => {
  const { query, answer, confidenceScore, status, correctedAnswer, domain } = req.body;
  if (!query || !status) {
    return res.status(400).json({ error: "Query and status fields are required." });
  }

  try {
    const feedbackId = await dbService.addFeedback({
      query,
      answer,
      confidenceScore,
      status,
      correctedAnswer,
      domain: domain || 'General'
    });
    console.log(`📝 Captured user gap feedback (${status}): ${feedbackId}`);
    res.json({ success: true, feedbackId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/feedback - Retrieves feedback corrections list for Audit Queue
 */
app.get('/api/feedback', async (req, res) => {
  try {
    const list = await dbService.getFeedback();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/feedback/resolve - Marks a gap feedback as resolved (Exercise 3 Lead Action)
 */
app.post('/api/feedback/resolve', async (req, res) => {
  const { feedbackId } = req.body;
  if (!feedbackId) {
    return res.status(400).json({ error: "feedbackId is required." });
  }

  try {
    const success = await dbService.resolveFeedback(feedbackId);
    if (!success) return res.status(404).json({ error: "Feedback item not found." });

    // Dynamic Self-Healing Index Sync
    const feedbackList = await dbService.getFeedback();
    const item = feedbackList.find(f => f.id === feedbackId);
    if (item && item.correctedAnswer && item.correctedAnswer.trim() !== '') {
      const chunkId = `virtual_fb_${feedbackId}`;
      const newChunk: DocumentChunk = {
        id: chunkId,
        filePath: `virtual/correction/${feedbackId}`,
        fileName: `virtual_correction_${feedbackId}`,
        fileType: 'transcript',
        content: item.correctedAnswer.trim(),
        author: 'System Operator (Approved)',
        attendees: [],
        date: new Date().toISOString().split('T')[0],
        domain: item.domain || 'General',
        priority: 'High'
      };

      const existingIdx = documentIndex.findIndex(c => c.id === chunkId);
      if (existingIdx > -1) {
        documentIndex[existingIdx] = newChunk;
      } else {
        documentIndex.push(newChunk);
      }
      console.log(`⚡ Self-healing Sync: Injected virtual correction chunk ${chunkId} into search index.`);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/metrics - Rolling instrumentation telemetry (Exercise 2 Audit requirement)
 */
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await dbService.getMetricsSummary();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start listening and trigger baseline bootstrap
app.listen(PORT, async () => {
  console.log(`🟢 AetherGrid Technologies Knowledge Server listening on port ${PORT}`);
  await bootstrapIndex();
});
