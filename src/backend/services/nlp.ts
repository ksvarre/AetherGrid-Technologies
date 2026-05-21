// @ts-ignore
import type { GoogleGenAI } from '@google/genai';
import { dbService } from './database';

export interface DocumentChunk {
  id: string;
  filePath: string;
  fileName: string;
  fileType: 'transcript' | 'docx' | 'pptx' | 'xlsx';
  content: string;
  author: string;
  attendees: string[];
  date: string;
  domain: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface Citation {
  chunkId: string;
  fileName: string;
  filePath: string;
  author: string;
  attendees: string[];
  date: string;
  matchedSnippet: string;
}

export interface SuggestedRouting {
  recipientName: string;
  recipientEmail: string;
  rationale: string;
  draftedQuestion: string;
}

export interface QueryResponse {
  answer: string;
  confidenceScore: number;
  citations: Citation[];
  suggestedRouting?: SuggestedRouting;
  domain: string;
  priority: 'High' | 'Medium' | 'Low';
  executionPipeline?: string[];
}

export interface INLPEngine {
  extractMetadata(fileName: string, content: string): Promise<Partial<DocumentChunk>>;
  queryDocuments(query: string, chunks: DocumentChunk[]): Promise<QueryResponse>;
}

// Stop words to clean tokens in offline mode
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you',
  'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Simple Porter-style suffix stemming algorithm to normalize suffixes: "s", "es", "ing", "ed".
 */
function stem(word: string): string {
  if (word.length <= 2) return word;

  if (word.endsWith('sses')) {
    return word.slice(0, -2); // classes -> class
  }
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'i'; // families -> famili
  }
  if (word.endsWith('es')) {
    const stemCandidate = word.slice(0, -2);
    if (/[xsz]|(ch)|(sh)$/.test(stemCandidate)) {
      return stemCandidate; // boxes -> box, beaches -> beach
    }
  }
  if (word.endsWith('ss')) {
    return word; // bypass
  }
  if (word.endsWith('s') && !word.endsWith('us') && !word.endsWith('is') && !word.endsWith('as')) {
    return word.slice(0, -1); // grids -> grid, nodes -> node
  }
  if (word.endsWith('eed')) {
    return word.slice(0, -1); // agreed -> agree
  }
  if (word.endsWith('ing')) {
    let stemCandidate = word.slice(0, -3);
    if (stemCandidate.length > 3 && stemCandidate.endsWith('n') && stemCandidate[stemCandidate.length - 2] === 'n') {
      stemCandidate = stemCandidate.slice(0, -1); // running -> run
    }
    return stemCandidate;
  }
  if (word.endsWith('ed')) {
    let stemCandidate = word.slice(0, -2);
    if (stemCandidate.length > 3 && stemCandidate[stemCandidate.length - 1] === stemCandidate[stemCandidate.length - 2]) {
      stemCandidate = stemCandidate.slice(0, -1); // tapped -> tap
    }
    return stemCandidate;
  }
  return word;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    .map(word => stem(word));
}
function getChunkSpeaker(chunk: DocumentChunk): string {
  const match = chunk.content.match(/^\*\*([^*:]+)\*\*:/);
  if (match) {
    return match[1].trim();
  }
  return chunk.author;
}


/**
 * ---------------------------------------------------------------------
 * OFFLINE STRATEGY: Pure JS BM25/TF-IDF text matching & entity heuristics
 * ---------------------------------------------------------------------
 */
export class OfflineNLPEngine implements INLPEngine {
  public async extractMetadata(fileName: string, content: string): Promise<Partial<DocumentChunk>> {
    // Basic offline heuristics for title-based matching
    const contentLower = content.toLowerCase();
    
    let domain = 'Product Commercials';
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';

    if (contentLower.includes('quantum') || contentLower.includes('forecasting') || contentLower.includes('mae')) {
      domain = 'Project Quantum';
      priority = 'High';
    } else if (contentLower.includes('helium') || contentLower.includes('substation') || contentLower.includes('hardware')) {
      domain = 'Project Helium';
      priority = 'High';
    } else if (contentLower.includes('horizon') || contentLower.includes('battery') || contentLower.includes('microgrid')) {
      domain = 'Project Horizon';
      priority = 'Medium';
    } else if (contentLower.includes('database') || contentLower.includes('kubernetes') || contentLower.includes('devops')) {
      domain = 'DevOps / Infrastructure';
      priority = 'Medium';
    } else if (contentLower.includes('safety') || contentLower.includes('compliance') || contentLower.includes('arc flash')) {
      domain = 'Safety & Compliance';
      priority = 'High';
    }

    return { domain, priority };
  }

  public async queryDocuments(query: string, chunks: DocumentChunk[]): Promise<QueryResponse> {
    const pipeline: string[] = [];
    pipeline.push(`[Ingest] In-memory active database contains ${chunks.length} text chunks ready for parsing.`);

    const queryTokens = tokenize(query);
    pipeline.push(`[Tokenize] Deconstructed query text: "${query}"`);
    pipeline.push(`[Stem & Clean] Extracted and stemmed query tokens: [${queryTokens.map(t => `'${t}'`).join(', ')}]`);

    if (queryTokens.length === 0) {
      pipeline.push(`[Analysis] Search terms failed stop-word whitelist. Aborting TF-IDF similarity calculation.`);
      return {
        answer: "I couldn't identify any searchable keywords in your query. Could you please specify a project (Quantum, Helium, Horizon) or technical term?",
        confidenceScore: 0.1,
        citations: [],
        domain: 'General',
        priority: 'Low',
        executionPipeline: pipeline
      };
    }

    // 1. Calculate TF-IDF similarities
    const N = chunks.length;
    const documentFrequencies: Record<string, number> = {};
    
    // Count document occurrences for IDF
    chunks.forEach(chunk => {
      const uniqueTokens = new Set(tokenize(chunk.content));
      uniqueTokens.forEach(token => {
        documentFrequencies[token] = (documentFrequencies[token] || 0) + 1;
      });
    });
    pipeline.push(`[IDF Setup] Calculated Inverse Document Frequency weights for ${Object.keys(documentFrequencies).length} vocabulary terms.`);

    // Score chunks
    pipeline.push(`[Similarity Index] Initiating TF-IDF cosine correlation matching across RAM corpus.`);
    const chunkScores = chunks.map(chunk => {
      const chunkTokens = tokenize(chunk.content);
      const tokenCounts: Record<string, number> = {};
      chunkTokens.forEach(t => { tokenCounts[t] = (tokenCounts[t] || 0) + 1; });

      let score = 0;
      const fillerWords = ['say', 'said', 'says', 'ask', 'asked', 'asks', 'tell', 'told', 'tells', 'talk', 'talks', 'spoke', 'speak'];
      const speakerNames = ['marcus', 'vance', 'amira', 'patel', 'david', 'kross', 'sarah', 'chen', 'elena', 'rostova'];

      queryTokens.forEach(token => {
        if (tokenCounts[token]) {
          const tf = tokenCounts[token] / chunkTokens.length;
          const df = documentFrequencies[token] || 1;
          let idf = Math.log(1 + N / df);
          
          // Downweight conversational filler words by 90%
          if (fillerWords.includes(token)) {
            idf = idf * 0.1;
          }
          
          // Boost score if keyword represents specific entities (includes first & last names)
          let boost = 1.0;
          if (['quantum', 'helium', 'horizon', 'rostova', 'vance', 'kross', 'patel', 'chen', 'marcus', 'amira', 'david', 'sarah', 'elena'].includes(token)) {
            boost = 2.0;
          }
          
          score += tf * idf * boost;
        }
      });

      // Metadata-aware Dialogue Speaker & Topic Affinity Boosts
      const activeSpeaker = getChunkSpeaker(chunk).toLowerCase();
      let speakerMatched = false;
      
      queryTokens.forEach(token => {
        if (speakerNames.includes(token) && activeSpeaker.includes(token)) {
          speakerMatched = true;
        }
      });

      if (speakerMatched) {
        score += 0.5; // Baseline speaker match boost
        
        // High affinity boost: if they matched the active speaker AND the dialogue contains
        // technical keywords (excluding speaker names and conversational filler words)
        const technicalQueryTokens = queryTokens.filter(t => 
          !fillerWords.includes(t) && !speakerNames.includes(t)
        );
        
        const contentTokens = new Set(chunkTokens);
        let technicalMatches = 0;
        technicalQueryTokens.forEach(t => {
          if (contentTokens.has(t)) {
            technicalMatches++;
          }
        });
        
        if (technicalMatches > 0) {
          score += 1.5 * technicalMatches; // Technical speaker-topic affinity boost
        }
      }

      // Attendee presence boost (minor query-attendant matching)
      let attendeeMatched = false;
      const attendeesLower = chunk.attendees.map(a => a.toLowerCase());
      queryTokens.forEach(token => {
        if (speakerNames.includes(token)) {
          const matchFound = attendeesLower.some(att => att.includes(token));
          if (matchFound) {
            attendeeMatched = true;
          }
        }
      });
      if (attendeeMatched) {
        score += 0.1; // minor baseline attendee presence boost
      }

      return { chunk, score };
    });

    // Filter and sort matching chunks
    const matches = chunkScores
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // top 3 matches

    if (matches.length === 0) {
      pipeline.push(`[Similarity Index] Cosine match scores = 0. No matching nodes located in active index scope.`);
      return {
        answer: "I couldn't find any relevant documents or meeting records in our database matching those search parameters.",
        confidenceScore: 0.05,
        citations: [],
        domain: 'General',
        priority: 'Low',
        executionPipeline: pipeline
      };
    }

    const rawMaxScore = matches[0].score;
    pipeline.push(`[Similarity Match] Located ${matches.length} matching text chunks exceeding retrieval threshold. Highest score: ${rawMaxScore.toFixed(4)}.`);

    // Determine dominant domain
    const domainCounts: Record<string, number> = {};
    matches.forEach(m => {
      domainCounts[m.chunk.domain] = (domainCounts[m.chunk.domain] || 0) + 1;
    });
    const dominantDomain = Object.keys(domainCounts).sort((a, b) => domainCounts[b] - domainCounts[a])[0] || 'General';
    const dominantPriority = matches[0].chunk.priority;
    pipeline.push(`[Classification] Domain mapping categorized as '${dominantDomain}' with priority: '${dominantPriority}'.`);

    // 2. Synthesize response text and citations
    const citations: Citation[] = [];
    const answerParagraphs: string[] = [];

    matches.forEach((m, idx) => {
      const marker = idx + 1;
      citations.push({
        chunkId: m.chunk.id,
        fileName: m.chunk.fileName,
        filePath: m.chunk.filePath,
        author: m.chunk.author,
        attendees: m.chunk.attendees,
        date: m.chunk.date,
        matchedSnippet: m.chunk.content
      });

      // Extract the most relevant sentence containing query keywords
      const sentences = m.chunk.content.split(/[.!?\r\n]+/).map(s => s.trim()).filter(Boolean);
      let bestSentence = sentences[0] || m.chunk.content;
      let maxWeight = -1;

      sentences.forEach(sentence => {
        const sentenceTokens = new Set(tokenize(sentence));
        let weight = 0;
        queryTokens.forEach(t => {
          if (sentenceTokens.has(t)) {
            const isSpeaker = ['marcus', 'vance', 'amira', 'patel', 'david', 'kross', 'sarah', 'chen', 'elena', 'rostova'].includes(t);
            const isFiller = ['say', 'said', 'says', 'ask', 'asked', 'asks', 'tell', 'told', 'tells', 'talk', 'talks', 'spoke', 'speak'].includes(t);
            if (isFiller) {
              weight += 0.1;
            } else if (isSpeaker) {
              weight += 1.0;
            } else {
              weight += 3.0; // High weight for technical keywords
            }
          }
        });
        if (weight > maxWeight || (weight === maxWeight && sentence.length > bestSentence.length && bestSentence.length < 50)) {
          maxWeight = weight;
          bestSentence = sentence;
        }
      });

      // Format clean citation text
      const cleanSect = bestSentence.length > 180 ? bestSentence.substring(0, 180) + '...' : bestSentence;
      const fileText = m.chunk.fileType === 'transcript' ? 'meeting minutes' : `${m.chunk.fileType} file`;
      
      answerParagraphs.push(`Based on ${m.chunk.author}'s notes in the ${m.chunk.fileName} (${fileText} dated ${m.chunk.date}): "${cleanSect}" [${marker}].`);
    });
    pipeline.push(`[Synthesis] Compiled ${citations.length} custom inline source citations with metadata mappings.`);

    // 3. Compute scaled confidence score
    // Highest score in matches acts as basis
    // Map raw score to a nice confidence scale [0.1, 0.95]
    const confidenceScore = Math.max(0.1, Math.min(0.95, 0.2 + rawMaxScore * 10));
    pipeline.push(`[Confidence Calibration] Evaluated relative confidence metrics. Match confidence calibrated to: ${confidenceScore.toFixed(2)}.`);

    let answer = `AetherGrid local database found references for your question:\n\n` + answerParagraphs.join("\n\n");
    
    // Log the query event to database
    await dbService.logQuery(query, confidenceScore, dominantDomain);
    pipeline.push(`[Telemetry] Instrumentation log written to SQLite database.`);

    return {
      answer,
      confidenceScore: parseFloat(confidenceScore.toFixed(2)),
      citations,
      domain: dominantDomain,
      priority: dominantPriority,
      executionPipeline: pipeline
    };
  }
}

/**
 * ---------------------------------------------------------------------
 * CLOUD STRATEGY: Google Gemini SDK integration (RAG Pipeline)
 * ---------------------------------------------------------------------
 */
export class GeminiNLPEngine implements INLPEngine {
  private ai: any = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async getAIInstance() {
    if (!this.ai) {
      // @ts-ignore
      const mod = await import('@google/genai');
      this.ai = new mod.GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.ai;
  }

  public async extractMetadata(fileName: string, content: string): Promise<Partial<DocumentChunk>> {
    try {
      const ai = await this.getAIInstance();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Extract metadata for this document in JSON format.
Document Name: "${fileName}"
Content Preview:
"${content.substring(0, 3000)}"

Return ONLY a JSON object with this shape (no markdown wrapping, no extra keys):
{
  "domain": "string (one of: Project Quantum, Project Helium, Project Horizon, DevOps / Infrastructure, Safety & Compliance, Product Commercials)",
  "priority": "string (one of: High, Medium, Low)"
}`,
      });

      const responseText = response.text || '{}';
      const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      return {
        domain: parsed.domain || 'General',
        priority: parsed.priority || 'Medium'
      };
    } catch (err) {
      console.warn("Failed to extract metadata via Gemini, falling back:", err);
      const fallback = new OfflineNLPEngine();
      return fallback.extractMetadata(fileName, content);
    }
  }

  public async queryDocuments(query: string, chunks: DocumentChunk[]): Promise<QueryResponse> {
    try {
      // 1. Sort chunks by keyword density first to select top 6 context chunks to feed the prompt
      const queryTokens = tokenize(query);
      const scored = chunks.map(chunk => {
        const tokens = new Set(tokenize(chunk.content));
        const matches = queryTokens.filter(t => tokens.has(t)).length;
        return { chunk, score: matches };
      }).sort((a, b) => b.score - a.score);

      const topChunks = scored.slice(0, 6).map(s => s.chunk);

      // 2. Synthesize context layout
      const contextString = topChunks.map((c, idx) => {
        return `[Chunk ID: ${c.id} | Source: ${c.fileName} | Author/Attendees: ${c.author || c.attendees.join(',')} | Date: ${c.date} | Domain: ${c.domain} | Priority: ${c.priority}]\nContent: ${c.content}`;
      }).join('\n\n---\n\n');

      // 3. Prompt Gemini
      const prompt = `You are the AetherGrid Technologies Knowledge Engine. 
You answer employee queries using ONLY the retrieved corporate corpus chunks below.
Every claim you make must cite the [Chunk ID] in the text (e.g. "[quantum_spec_c1]").

Retrieved Chunks:
${contextString}

User Question: "${query}"

Instructions:
1. Synthesize a comprehensive, professional, natural language answer.
2. Embed the Chunk ID inline at the end of claims (e.g. "Project Quantum validation achieved an MAE of 1.15 MW [quantum_spec_c1].")
3. Assess your confidence score in the answer (on a scale from 0.0 to 1.0) based on how well the context answered the question.
4. Output your response as a strict JSON object with this exact shape:
{
  "answer": "detailed text with inline citations",
  "confidenceScore": 0.85,
  "domain": "dominant topic area",
  "priority": "dominant priority rating",
  "citations": [
    {
      "chunkId": "string representing the cited chunk ID",
      "matchedSnippet": "precise sentence or grid string matching the citation from the chunk content"
    }
  ]
}
Return ONLY the raw JSON object. Do not wrap in markdown \`\`\`json blocks.`;

      const ai = await this.getAIInstance();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const responseText = response.text || '{}';
      const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText);

      // Re-map full citation details from topChunks
      const fullCitations = (parsed.citations || []).map((cit: any) => {
        const original = topChunks.find(c => c.id === cit.chunkId);
        if (original) {
          return {
            chunkId: original.id,
            fileName: original.fileName,
            filePath: original.filePath,
            author: original.author,
            attendees: original.attendees,
            date: original.date,
            matchedSnippet: cit.matchedSnippet || original.content.substring(0, 200)
          };
        }
        return null;
      }).filter(Boolean) as Citation[];

      // Replace Gemini Chunk ID annotations in answer string to user friendly numbers (e.g. [1], [2])
      let UserAnswer = parsed.answer || '';
      const finalCitations: Citation[] = [];

      fullCitations.forEach((cit, idx) => {
        const marker = idx + 1;
        const markerRegex = new RegExp(`\\[${cit.chunkId}\\]`, 'g');
        if (UserAnswer.match(markerRegex)) {
          UserAnswer = UserAnswer.replace(markerRegex, `[${marker}]`);
          finalCitations.push(cit);
        }
      });

      // If no markers matched but we have citations, append them
      if (finalCitations.length === 0 && fullCitations.length > 0) {
        fullCitations.forEach((cit, idx) => {
          finalCitations.push(cit);
          UserAnswer += ` [${idx + 1}]`;
        });
      }

      const conf = parsed.confidenceScore || 0.8;
      const dom = parsed.domain || topChunks[0]?.domain || 'General';
      const prio = parsed.priority || topChunks[0]?.priority || 'Medium';

      // Log metrics to DB
      await dbService.logQuery(query, conf, dom);

      return {
        answer: UserAnswer,
        confidenceScore: conf,
        citations: finalCitations,
        domain: dom,
        priority: prio
      };
    } catch (err) {
      console.warn("Failed Gemini Query, falling back to offline retrieval:", err);
      const fallback = new OfflineNLPEngine();
      return fallback.queryDocuments(query, chunks);
    }
  }
}
