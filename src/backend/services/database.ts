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
  domain: string;
}

export interface MetricSummary {
  rollingAvgConfidence: number;
  rejectionRate: number;
  systemHealthIndex: number;
  healthLevel: 'Healthy' | 'Warning' | 'Critical';
  totalQueriesCount: number;
  correctionsCount: number;
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
function escapeHtml(text: string): string {
  if (!text) return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

async function safeWriteJson(filePath: string, data: any): Promise<void> {
  const tempPath = filePath + '.tmp';
  await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, filePath);
}

export class DatabaseService {
  constructor() {
    this.ensureDatabaseFiles();
  }

  private ensureDatabaseFiles() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(FEEDBACK_PATH)) {
      fs.writeFileSync(FEEDBACK_PATH, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(QUERIES_LOG_PATH)) {
      fs.writeFileSync(QUERIES_LOG_PATH, JSON.stringify([], null, 2));
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
    await safeWriteJson(FEEDBACK_PATH, feedbackList);
    return id;
  }

  public async resolveFeedback(feedbackId: string): Promise<boolean> {
    const feedbackList = await this.getFeedback();
    const item = feedbackList.find(f => f.id === feedbackId);
    if (!item) return false;

    item.resolved = true;
    await safeWriteJson(FEEDBACK_PATH, feedbackList);
    return true;
  }

  // Queries Log (for Instrumentation)
  public async logQuery(query: string, confidenceScore: number, domain: string): Promise<void> {
    this.ensureDatabaseFiles();
    try {
      const data = await fs.promises.readFile(QUERIES_LOG_PATH, 'utf-8');
      const log = JSON.parse(data);
      log.push({
        query: escapeHtml(query),
        confidenceScore,
        domain: escapeHtml(domain),
        timestamp: new Date().toISOString()
      });
      await safeWriteJson(QUERIES_LOG_PATH, log);
    } catch (err) {
      console.error("Error logging query metrics:", err);
    }
  }

  public async getQueryLogs(): Promise<{ query: string; confidenceScore: number; domain: string; timestamp: string }[]> {
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

    return {
      rollingAvgConfidence: parseFloat(totalConfidence.toFixed(2)),
      rejectionRate: parseFloat(rejectionRate.toFixed(2)),
      systemHealthIndex: parseFloat(systemHealthIndex.toFixed(2)),
      healthLevel,
      totalQueriesCount: queryLogs.length,
      correctionsCount,
      gapHotspots
    };
  }
}
export const dbService = new DatabaseService();
