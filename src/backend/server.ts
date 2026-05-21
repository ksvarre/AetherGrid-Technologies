import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { parserService } from './services/parser';
import { INLPEngine, OfflineNLPEngine, GeminiNLPEngine, AzureOpenAINLPEngine, DocumentChunk } from './services/nlp';
import { routingService } from './services/routing';
import { dbService } from './services/database';

// Trigger nodemon reload again
const getDir = (sub: string) => {
  let p = path.resolve(__dirname, `../../${sub}`);
  if (fs.existsSync(p)) return p;
  p = path.resolve(__dirname, `../../../${sub}`);
  if (fs.existsSync(p)) return p;
  p = path.resolve(process.cwd(), sub);
  if (fs.existsSync(p)) return p;
  return path.resolve(__dirname, `../../${sub}`); // Default fallback
};

const TRANSCRIPTS_DIR = getDir('data/transcripts');
const DOCUMENTS_DIR = getDir('data/documents');

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Hardening ────────────────────────────────────────────────────────
// Helmet: Sets secure HTTP headers (X-Content-Type-Options, X-Frame-Options,
// X-XSS-Protection, Referrer-Policy, Strict-Transport-Security, etc.)
app.use(helmet());

// CORS: Restrict to known frontend origins instead of wildcard
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Alternative dev port
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'x-cloud-provider', 'x-gemini-api-key', 'x-azure-api-key', 'x-azure-endpoint', 'x-azure-deployment']
}));

// Body parser with explicit size limit to prevent oversized payloads
app.use(express.json({ limit: '100kb' }));

// Rate Limiters: Prevent abuse and DoS on expensive endpoints
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 60,               // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,               // 30 queries/min — NLP ops are expensive
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Query rate limit exceeded. Please wait before sending more queries.' }
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,                // 5 admin actions/min — ingest, resolve
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Admin action rate limit exceeded. Please wait before retrying.' }
});

app.use('/api', generalLimiter);

// Optional API Key Authentication Middleware
// Set API_AUTH_KEY in .env to enable. If unset, all requests are allowed (dev mode).
const API_AUTH_KEY = process.env.API_AUTH_KEY;
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (API_AUTH_KEY && API_AUTH_KEY.trim() !== '') {
    const providedKey = req.headers['x-api-key'];
    if (providedKey !== API_AUTH_KEY) {
      return res.status(401).json({ error: 'Unauthorized. Provide a valid x-api-key header.' });
    }
  }
  next();
};

// Security helper: Sanitize error messages to prevent internal detail leakage
const sanitizeError = (err: any): string => {
  const msg = err?.message || String(err);
  // Strip file paths, stack traces, and internal identifiers
  if (msg.includes('ENOENT') || msg.includes('EACCES') || msg.includes('EPERM')) {
    return 'A file system error occurred. Please contact an administrator.';
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed')) {
    return 'An external service connection error occurred. Please try again later.';
  }
  // Cap length and strip anything that looks like a file path
  return msg.replace(/[A-Z]:\\[^\s]*/gi, '[path]').replace(/\/[^\s]*\/[^\s]*/g, '[path]').substring(0, 200);
};

// Maximum query length to prevent DoS via oversized NLP tokenization
const MAX_QUERY_LENGTH = 500;

// Valid feedback status values (runtime enum enforcement)
const VALID_FEEDBACK_STATUSES = new Set(['correct', 'incorrect', 'correction', 'rejection']);

// Document memory index
let documentIndex: DocumentChunk[] = [];
let nlpEngine: INLPEngine;

// Initialize the default server-wide NLP Engine Strategy
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
  console.log("⚡ Starting AetherGrid Knowledge API in Enterprise Cloud Mode (Gemini RAG).");
  nlpEngine = new GeminiNLPEngine(apiKey);
} else {
  console.log("🔌 GEMINI_API_KEY missing or empty in .env. Starting in local Offline Mode (TF-IDF Indexer).");
  nlpEngine = new OfflineNLPEngine();
}

/**
 * Resolves request-scoped INLPEngine dynamically from transient headers
 */
const resolveEngineFromHeaders = (headers: any): INLPEngine => {
  const provider = headers['x-cloud-provider'];
  if (provider === 'gemini') {
    const geminiKey = headers['x-gemini-api-key'];
    if (geminiKey && typeof geminiKey === 'string' && geminiKey.trim() !== '') {
      return new GeminiNLPEngine(geminiKey);
    }
  } else if (provider === 'azure') {
    const azureKey = headers['x-azure-api-key'];
    const azureEndpoint = headers['x-azure-endpoint'];
    const azureDeployment = headers['x-azure-deployment'];
    if (
      azureKey && typeof azureKey === 'string' && azureKey.trim() !== '' &&
      azureEndpoint && typeof azureEndpoint === 'string' && azureEndpoint.trim() !== '' &&
      azureDeployment && typeof azureDeployment === 'string' && azureDeployment.trim() !== ''
    ) {
      return new AzureOpenAINLPEngine(azureKey, azureEndpoint, azureDeployment);
    }
  } else if (provider === 'local') {
    return new OfflineNLPEngine();
  }
  // Fallback to default server-wide engine
  return nlpEngine;
};

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
        content: `[Query Correlation: "${item.query}"] - Resolved Answer: ${item.correctedAnswer!.trim()}`,
        author: 'System Operator (Approved)',
        attendees: [],
        date: item.timestamp ? item.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
        domain: item.domain || 'General',
        priority: 'High',
        queryCorrelation: item.query
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
    // Boot up starts locally to ensure immediate response
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
    mode: (apiKey && apiKey !== 'your_gemini_api_key_here') ? "Enterprise Cloud" : "Offline Fallback",
    chunksIndexed: documentIndex.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/ingest - Manual re-trigger of filesystem scanning
 */
app.post('/api/ingest', requireAuth, adminLimiter, async (req, res) => {
  const activeEngine = resolveEngineFromHeaders(req.headers);
  const errorContainer: { cloudError?: any } = {};

  try {
    console.log("🔄 Re-scanning data folders by operator request...");
    const chunks = await parserService.ingestAll(activeEngine, errorContainer);
    documentIndex = chunks;
    await injectResolvedCorrections();

    res.json({
      success: true,
      message: `Re-indexed workspace successfully.`,
      count: documentIndex.length,
      cloudError: errorContainer.cloudError
    });
  } catch (err: any) {
    console.warn("⚠️ Ingestion failed under cloud activeEngine, performing safe local fallback ingestion...", err);
    
    // Translate cloud error
    let cloudError = { code: 'UNKNOWN_CLOUD_ERROR', message: err.message || String(err), fallbackActive: true };
    if (activeEngine instanceof GeminiNLPEngine) {
      cloudError = { ...GeminiNLPEngine.translateError(err), fallbackActive: true };
    } else if (activeEngine instanceof AzureOpenAINLPEngine) {
      cloudError = { ...AzureOpenAINLPEngine.translateError(err), fallbackActive: true };
    }

    try {
      const localEngine = new OfflineNLPEngine();
      documentIndex = await parserService.ingestAll(localEngine);
      await injectResolvedCorrections();
      res.json({
        success: true,
        message: `Re-indexed workspace successfully using local fallback.`,
        count: documentIndex.length,
        cloudError
      });
    } catch (fallbackErr: any) {
      res.status(500).json({ success: false, error: sanitizeError(fallbackErr) });
    }
  }
});

/**
 * POST /api/query - Natural language semantic search with self-healing cloud fallback gate
 */
app.post('/api/query', requireAuth, queryLimiter, async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: "Query parameter is required and must be a string." });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters.` });
  }

  const activeEngine = resolveEngineFromHeaders(req.headers);

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
    const result = await activeEngine.queryDocuments(query, documentIndex);

    // If search confidence is low (< 0.40), append the Low-Confidence suggested routing (Exercise 2)
    if (result.confidenceScore < 0.40) {
      console.log(`⚠️ Low confidence search result (${result.confidenceScore}). Invoking routing generator.`);
      // Pass top matched chunks so the routing rationale references the actual content found
      const matchedChunks = result.citations.map(cit => documentIndex.find(c => c.id === cit.chunkId)).filter(Boolean) as typeof documentIndex;
      result.suggestedRouting = routingService.generateRouting(query, result.domain, matchedChunks) ?? undefined;
    }

    res.json(result);
  } catch (err: any) {
    console.warn("⚠️ Query failed under cloud activeEngine, executing self-healing fallback query. Error detail:", err);
    
    // Decode exact HTTP or connection error details into highly granular diagnostics
    let cloudError = { code: 'UNKNOWN_CLOUD_ERROR', message: err.message || String(err), fallbackActive: true };
    if (activeEngine instanceof GeminiNLPEngine) {
      cloudError = { ...GeminiNLPEngine.translateError(err), fallbackActive: true };
    } else if (activeEngine instanceof AzureOpenAINLPEngine) {
      cloudError = { ...AzureOpenAINLPEngine.translateError(err), fallbackActive: true };
    }

    try {
      // Execute using standard local offline strategy engine immediately
      const localEngine = new OfflineNLPEngine();
      const result = await localEngine.queryDocuments(query, documentIndex);
      if (result.confidenceScore < 0.40) {
        const matchedChunks = result.citations.map(cit => documentIndex.find(c => c.id === cit.chunkId)).filter(Boolean) as typeof documentIndex;
        result.suggestedRouting = routingService.generateRouting(query, result.domain, matchedChunks) ?? undefined;
      }
      res.json({
        ...result,
        cloudError
      });
    } catch (offlineErr: any) {
      console.error("❌ Critical: Offline fallback query failed:", offlineErr);
      res.status(500).json({ error: sanitizeError(offlineErr) });
    }
  }
});

/**
 * POST /api/feedback - Submits user corrections or query rejections
 */
app.post('/api/feedback', requireAuth, async (req, res) => {
  const { query, answer, confidenceScore, status, correctedAnswer, domain } = req.body;
  if (!query || !status) {
    return res.status(400).json({ error: "Query and status fields are required." });
  }
  if (!VALID_FEEDBACK_STATUSES.has(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_FEEDBACK_STATUSES].join(', ')}` });
  }
  if (typeof query !== 'string' || query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: 'Invalid query field.' });
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
    res.status(500).json({ success: false, error: sanitizeError(err) });
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
    res.status(500).json({ error: sanitizeError(err) });
  }
});

/**
 * POST /api/feedback/resolve - Marks a gap feedback as resolved (Exercise 3 Lead Action)
 */
app.post('/api/feedback/resolve', requireAuth, adminLimiter, async (req, res) => {
  const { feedbackId } = req.body;
  if (!feedbackId || typeof feedbackId !== 'string') {
    return res.status(400).json({ error: "feedbackId is required and must be a string." });
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
        content: `[Query Correlation: "${item.query}"] - Resolved Answer: ${item.correctedAnswer.trim()}`,
        author: 'System Operator (Approved)',
        attendees: [],
        date: new Date().toISOString().split('T')[0],
        domain: item.domain || 'General',
        priority: 'High',
        queryCorrelation: item.query
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
    res.status(500).json({ error: sanitizeError(err) });
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
    res.status(500).json({ error: sanitizeError(err) });
  }
});

/**
 * GET /api/reformulations - Returns all detected query reformulation pairs
 * Provides the drill-down data so operators can see WHICH queries users are rephrasing,
 * grouped by domain, to prioritize knowledge base improvement areas.
 */
app.get('/api/reformulations', async (req, res) => {
  try {
    const queryLogs = await dbService.getQueryLogs();
    const reformulations = queryLogs
      .filter(q => q.isReformulation && q.reformulationOf)
      .map(q => ({
        rephrasedQuery: q.query,
        originalQuery: q.reformulationOf,
        domain: q.domain,
        confidenceScore: q.confidenceScore,
        timestamp: q.timestamp
      }));
    res.json(reformulations);
  } catch (err: any) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

/**
 * GET /api/documents/download/:filename - Secure document download bridge with strict path traversal guards
 */
app.get('/api/documents/download/:filename', (req, res) => {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename || typeof rawFilename !== 'string') {
      return res.status(400).json({ error: "Filename parameter is required." });
    }

    // Neutralize directory traversal sequences using path.basename
    const filename = path.basename(rawFilename);

    // Resolve candidates
    const docPath = path.join(DOCUMENTS_DIR, filename);
    const transPath = path.join(TRANSCRIPTS_DIR, filename);

    let targetPath = '';
    if (fs.existsSync(docPath)) {
      targetPath = docPath;
    } else if (fs.existsSync(transPath)) {
      targetPath = transPath;
    }

    if (!targetPath) {
      return res.status(404).json({ error: "Document not found in knowledge database." });
    }

    // Strict security assertion: Verify resolved path begins with the absolute workspace root
    const resolvedPath = path.resolve(targetPath);
    const workspaceRoot = path.resolve(process.cwd());
    if (!resolvedPath.startsWith(workspaceRoot)) {
      return res.status(403).json({ error: "Access denied. Path traversal violation detected." });
    }

    res.download(resolvedPath, filename);
  } catch (err: any) {
    console.error("Download endpoint execution error:", err);
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// Start listening and trigger baseline bootstrap
app.listen(PORT, async () => {
  console.log(`🟢 AetherGrid Technologies Knowledge Server listening on port ${PORT}`);
  await bootstrapIndex();
});
