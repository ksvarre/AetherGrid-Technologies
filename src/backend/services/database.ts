import fs from 'fs';
import path from 'path';

export interface FeedbackItem {
  id: string;
  query: string;
  answer: string;
  confidenceScore: number;
  status: 'correct' | 'incorrect' | 'correction' | 'rejection';
  correctedAnswer?: string;
  timestamp: string;
  resolved: boolean;
  resolvedTimestamp?: string;
  domain: string;
}

export interface MetricSummary {
  rollingAvgConfidence: number;
  rejectionRate: number;
  systemHealthIndex: number;
  healthLevel: 'Healthy' | 'Warning' | 'Critical';
  totalQueriesCount: number;
  correctionsCount: number;
  reformulationRate: number;
  gapHotspots: { domain: string; count: number }[];
}

const getDir = (sub: string) => {
  let p = path.resolve(__dirname, `../../../${sub}`);
  if (fs.existsSync(p)) return p;
  p = path.resolve(__dirname, `../../../../${sub}`);
  if (fs.existsSync(p)) return p;
  p = path.resolve(process.cwd(), sub);
  if (fs.existsSync(p)) return p;
  return path.resolve(__dirname, `../../../${sub}`); // Default fallback
};

const DB_DIR = getDir('data/db');
const FEEDBACK_PATH = path.join(DB_DIR, 'feedback.json');
const QUERIES_LOG_PATH = path.join(DB_DIR, 'queries_log.json');

// Security & Robustness Helpers
// Note: Only escapes HTML-injection vectors (<, >, &, "). Single quotes and
// forward slashes are intentionally NOT escaped because React's JSX rendering
// already auto-escapes all text output — double-encoding causes visible
// corruption (e.g. "couldn&#x27;t" instead of "couldn't").
function escapeHtml(text: string): string {
  if (!text) return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function safeWriteJson(filePath: string, data: any): Promise<void> {
  const tempPath = filePath + '.tmp';
  await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, filePath);
}

/**
 * Lightweight tokenizer for query reformulation comparison.
 * Strips stop words and lowercases for semantic overlap detection.
 */
const STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','may','might','can','could','and','but','or','if','then','else','when','at','by','for','with','about','against','between','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','than','that','this','these','those','what','which','who','whom','how','where','why','i','me','my','we','our','you','your','he','she','it','they','them','not','no','so','just','also','very','of']);

function tokenizeForComparison(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Jaccard similarity: measures token overlap between two queries.
 * Returns 0.0 (no overlap) to 1.0 (identical tokens).
 */
function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export class DatabaseService {
  // Security: FIFO caps to prevent unbounded disk growth from abuse
  private static readonly MAX_FEEDBACK_ENTRIES = 1000;
  private static readonly MAX_QUERY_LOG_ENTRIES = 2000;

  constructor() {
    this.ensureDatabaseFiles();
  }

  private ensureDatabaseFiles() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(FEEDBACK_PATH)) {
      const seedFeedback = [
        {
          id: "fb_seed_1",
          query: "What is the Project Quantum MAE forecasting target and validation status?",
          answer: "Project Quantum's model target is an MAE (Mean Absolute Error) of less than 1.5% across all test nodes. The validation status is currently marked as 'Passed' for residential and light-commercial grids.",
          confidenceScore: 0.95,
          status: "correct",
          domain: "Project Quantum",
          timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          resolved: true,
          resolvedTimestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 3600000).toISOString()
        },
        {
          id: "fb_seed_2",
          query: "How do you bake a chocolate chip cookie at home?",
          answer: "I couldn't find any relevant documents or meeting records in our database matching those search parameters.",
          confidenceScore: 0.05,
          status: "rejection",
          domain: "Operations",
          timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          resolved: false
        },
        {
          id: "fb_seed_3",
          query: "What did Marcus say about the edge node firmware overheating issue?",
          answer: "Marcus Vance stated that the fan curve profile in the current firmware was set to low-RPM to minimize residential noise, causing core temperatures to spike under Elena's telemetry processing scripts.",
          confidenceScore: 0.92,
          status: "correct",
          domain: "Project Helium",
          timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
          resolved: true,
          resolvedTimestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000 + 1800000).toISOString()
        },
        {
          id: "fb_seed_4",
          query: "When will the decentralized microgrid pitch be ready?",
          answer: "I couldn't find a specific launch date in the transcripts.",
          confidenceScore: 0.35,
          status: "correction",
          correctedAnswer: "The decentralized microgrid pitch deck is scheduled for executive review on June 15th, 2026, as per Amira Patel's slide roadmap.",
          domain: "Project Horizon",
          timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
          resolved: false
        }
      ];
      fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(seedFeedback, null, 2), 'utf-8');
    }

    if (!fs.existsSync(QUERIES_LOG_PATH)) {
      const seedLogs: any[] = [];
      const nowMs = Date.now();
      const queries = [
        { q: "What is the Project Quantum MAE forecasting target and validation status?", d: "Project Quantum", c: 0.95 },
        { q: "What are the quantum forecasting targets?", d: "Project Quantum", c: 0.95 },
        { q: "How do we fix firmware bricking on edge devices?", d: "Project Helium", c: 0.92 },
        { q: "What did Marcus say about firmware?", d: "Project Helium", c: 0.92 },
        { q: "How much does GridPulse licensing cost?", d: "Product Commercials", c: 0.88 },
        { q: "When will the decentralized microgrid pitch be ready?", d: "Project Horizon", c: 0.35 },
        { q: "What is our database scaling capacity?", d: "DevOps / Database", c: 0.91 },
        { q: "What are the safety protocols for substation operations?", d: "Safety & Compliance", c: 0.89 },
        { q: "Tell me about the solar panel discharge rates", d: "Project Horizon", c: 0.94 },
        { q: "What is the chassis fan configuration?", d: "Project Helium", c: 0.90 }
      ];

      for (let i = 45; i >= 0; i--) {
        const queryObj = queries[i % queries.length];
        const timeOffset = i * 4 * 3600 * 1000 + Math.floor(Math.random() * 3600 * 1000);
        const logTime = new Date(nowMs - timeOffset);
        
        let isReformulation = false;
        let reformulationOf: string | undefined;

        if (i % 7 === 0) {
          isReformulation = true;
          reformulationOf = queries[(i + 1) % queries.length].q;
        }

        seedLogs.push({
          query: queryObj.q,
          confidenceScore: queryObj.c,
          domain: queryObj.d,
          timestamp: logTime.toISOString(),
          isReformulation,
          reformulationOf
        });
      }
      fs.writeFileSync(QUERIES_LOG_PATH, JSON.stringify(seedLogs, null, 2), 'utf-8');
    }
  }

  // Feedback Store (Corrections / Rejections)
  public async getFeedback(): Promise<FeedbackItem[]> {
    this.ensureDatabaseFiles();
    try {
      const data = await fs.promises.readFile(FEEDBACK_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error("Error reading feedback DB:", err);
      return [];
    }
  }

  public async addFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'resolved'>): Promise<string> {
    const feedbackList = await this.getFeedback();
    const id = 'fb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newItem: FeedbackItem = {
      ...feedback,
      query: escapeHtml(feedback.query),
      answer: escapeHtml(feedback.answer),
      correctedAnswer: feedback.correctedAnswer ? escapeHtml(feedback.correctedAnswer) : undefined,
      domain: escapeHtml(feedback.domain),
      id,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    feedbackList.push(newItem);

    // FIFO rotation: drop oldest entries if cap exceeded
    const trimmed = feedbackList.length > DatabaseService.MAX_FEEDBACK_ENTRIES
      ? feedbackList.slice(-DatabaseService.MAX_FEEDBACK_ENTRIES)
      : feedbackList;

    await safeWriteJson(FEEDBACK_PATH, trimmed);
    return id;
  }

  public async resolveFeedback(feedbackId: string): Promise<boolean> {
    const feedbackList = await this.getFeedback();
    const item = feedbackList.find(f => f.id === feedbackId);
    if (!item) return false;

    item.resolved = true;
    item.resolvedTimestamp = new Date().toISOString();
    await safeWriteJson(FEEDBACK_PATH, feedbackList);
    return true;
  }

  // Queries Log (for Instrumentation & Reformulation Detection)
  public async logQuery(query: string, confidenceScore: number, domain: string, sessionId?: string): Promise<void> {
    this.ensureDatabaseFiles();
    try {
      const data = await fs.promises.readFile(QUERIES_LOG_PATH, 'utf-8');
      const log = JSON.parse(data);

      // Detect query reformulation: check if this query is a rephrasing of a recent query
      // within a 5-minute window (same session or time-based fallback)
      let isReformulation = false;
      let reformulationOf: string | undefined;
      const now = Date.now();
      const REFORMULATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
      const SIMILARITY_THRESHOLD = 0.40; // 40% token overlap = likely reformulation
      const currentTokens = tokenizeForComparison(query);

      // Scan recent queries (last 20 max) for reformulation patterns
      const recentQueries = log.slice(-20).reverse();
      for (const prev of recentQueries) {
        const timeDiff = now - new Date(prev.timestamp).getTime();
        if (timeDiff > REFORMULATION_WINDOW_MS) break; // Outside time window

        // Check if the session matches (if sessionId provided) or fall back to time proximity
        const sameSession = sessionId && prev.sessionId && sessionId === prev.sessionId;
        if (!sameSession && timeDiff > REFORMULATION_WINDOW_MS) continue;

        const prevTokens = tokenizeForComparison(prev.query || '');
        const similarity = jaccardSimilarity(currentTokens, prevTokens);

        // If >40% overlap but query text is different → reformulation detected
        if (similarity >= SIMILARITY_THRESHOLD && prev.query !== escapeHtml(query)) {
          isReformulation = true;
          reformulationOf = prev.query;
          console.log(`🔄 Reformulation detected: "${query}" is a rephrasing of "${prev.query}" (${(similarity * 100).toFixed(0)}% overlap)`);
          break;
        }
      }

      log.push({
        query: escapeHtml(query),
        confidenceScore,
        domain: escapeHtml(domain),
        timestamp: new Date().toISOString(),
        sessionId: sessionId || undefined,
        isReformulation,
        reformulationOf
      });

      // FIFO rotation: drop oldest entries if cap exceeded
      const trimmed = log.length > DatabaseService.MAX_QUERY_LOG_ENTRIES
        ? log.slice(-DatabaseService.MAX_QUERY_LOG_ENTRIES)
        : log;

      await safeWriteJson(QUERIES_LOG_PATH, trimmed);
    } catch (err) {
      console.error("Error logging query metrics:", err);
    }
  }

  public async getQueryLogs(): Promise<{ query: string; confidenceScore: number; domain: string; timestamp: string; sessionId?: string; isReformulation?: boolean; reformulationOf?: string }[]> {
    this.ensureDatabaseFiles();
    try {
      const data = await fs.promises.readFile(QUERIES_LOG_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      return [];
    }
  }

  // Metrics Calculations (Rolling 30-Day Metrics)
  public async getMetricsSummary(): Promise<MetricSummary> {
    const feedback = await this.getFeedback();
    const queryLogs = await this.getQueryLogs();

    const activeFeedback = feedback.filter(f => !f.resolved);

    // Calculate rolling values
    const totalQueries = queryLogs.length || 1; // avoid divide by zero
    const correctionsCount = feedback.filter(f => f.status === 'incorrect' || f.status === 'correction' || f.status === 'rejection').length;

    // Rolling Average Confidence
    let totalConfidence = 0;
    if (queryLogs.length > 0) {
      totalConfidence = queryLogs.reduce((acc, curr) => acc + curr.confidenceScore, 0) / queryLogs.length;
    } else {
      totalConfidence = 0.85; // Initial healthy benchmark
    }

    // User Rejection Rate (Percentage of queries that resulted in a user rejection or correction)
    const rejectionRate = totalQueries > 0 ? correctionsCount / totalQueries : 0;

    // System Health Index = Avg Confidence * (1 - Rejection Rate)
    const systemHealthIndex = Math.max(0, Math.min(1, totalConfidence * (1 - rejectionRate)));

    // Categorize health level
    let healthLevel: 'Healthy' | 'Warning' | 'Critical' = 'Healthy';
    if (systemHealthIndex < 0.55) {
      healthLevel = 'Critical';
    } else if (systemHealthIndex < 0.68 || rejectionRate > 0.20) {
      healthLevel = 'Warning';
    }

    // Calculate Gap Hotspots (Which domains get the most corrections)
    const domainCounts: Record<string, number> = {};
    feedback.forEach(f => {
      const d = f.domain || 'Uncategorized';
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    });

    const gapHotspots = Object.keys(domainCounts)
      .map(domain => ({ domain, count: domainCounts[domain] }))
      .sort((a, b) => b.count - a.count);

    // Reformulation Rate: percentage of queries that are rephrased versions of earlier queries
    // This measures implicit user dissatisfaction (users who rephrase rather than flag gaps)
    const reformulationCount = queryLogs.filter(q => q.isReformulation).length;
    const reformulationRate = queryLogs.length > 0 ? reformulationCount / queryLogs.length : 0;

    return {
      rollingAvgConfidence: parseFloat(totalConfidence.toFixed(2)),
      rejectionRate: parseFloat(rejectionRate.toFixed(2)),
      systemHealthIndex: parseFloat(systemHealthIndex.toFixed(2)),
      healthLevel,
      totalQueriesCount: queryLogs.length,
      correctionsCount,
      reformulationRate: parseFloat(reformulationRate.toFixed(2)),
      gapHotspots
    };
  }
}
export const dbService = new DatabaseService();
