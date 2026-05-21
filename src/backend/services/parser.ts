import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import officeParser from 'officeparser';
import { DocumentChunk, INLPEngine, GeminiNLPEngine, AzureOpenAINLPEngine } from './nlp';

const getDir = (sub: string) => {
  let p = path.resolve(__dirname, `../../../${sub}`);
  if (fs.existsSync(p)) return p;
  p = path.resolve(__dirname, `../../../../${sub}`);
  if (fs.existsSync(p)) return p;
  p = path.resolve(process.cwd(), sub);
  if (fs.existsSync(p)) return p;
  return path.resolve(__dirname, `../../../${sub}`); // Default fallback
};

const TRANSCRIPTS_DIR = getDir('data/transcripts');
const DOCUMENTS_DIR = getDir('data/documents');

const virtualizePath = (filePath: string): string => {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
};

interface CacheEntry {
  mtime: number;
  size: number;
  chunks: DocumentChunk[];
}

interface IngestionCache {
  version: string;
  files: Record<string, CacheEntry>;
}

const DB_DIR = getDir('data/db');
const CACHE_PATH = path.join(DB_DIR, 'indexed_chunks.json');

async function safeWriteJson(filePath: string, data: any): Promise<void> {
  const tempPath = filePath + '.tmp';
  await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, filePath);
}

export class ParserService {
  /**
   * Helper to enrich metadata using cloud NLP engine if available.
   * If extraction fails, logs warning, saves translated error, and disables subsequent cloud calls in this run.
   */
  private async enrichMetadata(
    fileName: string,
    rawContent: string,
    nlpEngine?: INLPEngine,
    errorContainer?: { cloudError?: any },
    defaults: Partial<DocumentChunk> = {}
  ): Promise<Partial<DocumentChunk>> {
    const meta = { ...defaults };
    if (nlpEngine && errorContainer && !errorContainer.cloudError) {
      try {
        const enriched = await nlpEngine.extractMetadata(fileName, rawContent);
        if (enriched.domain) meta.domain = enriched.domain;
        if (enriched.priority) meta.priority = enriched.priority;
        if (enriched.author) meta.author = enriched.author;
        if (enriched.attendees) meta.attendees = enriched.attendees;
        if (enriched.decisions) meta.decisions = enriched.decisions;
        if (enriched.actionItems) meta.actionItems = enriched.actionItems;
      } catch (err: any) {
        console.warn(`⚠️ Cloud metadata extraction failed for ${fileName}. Disabling cloud enrichment and falling back to offline heuristics.`, err);
        // Translate error using engine static methods
        if (nlpEngine instanceof GeminiNLPEngine) {
          errorContainer.cloudError = GeminiNLPEngine.translateError(err);
        } else if (nlpEngine instanceof AzureOpenAINLPEngine) {
          errorContainer.cloudError = AzureOpenAINLPEngine.translateError(err);
        } else {
          errorContainer.cloudError = { code: 'UNKNOWN_CLOUD_ERROR', message: err.message || String(err) };
        }
        errorContainer.cloudError.fallbackActive = true;
      }
    }
    return meta;
  }

  /**
   * Main entry point: Scans directories, parses files, and returns semantic chunks.
   */
  public async ingestAll(nlpEngine?: INLPEngine, errorContainer?: { cloudError?: any }): Promise<DocumentChunk[]> {
    const startTime = Date.now();
    const allChunks: DocumentChunk[] = [];
    const seenPaths = new Set<string>();
    let hitCount = 0;
    let missCount = 0;

    // Ensure db folder exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    // Try to load ingestion cache
    let cache: IngestionCache = { version: '1.0', files: {} };
    try {
      if (fs.existsSync(CACHE_PATH)) {
        const cacheData = await fs.promises.readFile(CACHE_PATH, 'utf-8');
        cache = JSON.parse(cacheData);
        if (!cache.files) cache.files = {};
      }
    } catch (err) {
      console.warn("⚠️ Failed to load ingestion cache, starting fresh:", err);
    }

    let cacheDirty = false;

    // 1. Ingest Transcripts (.md)
    if (fs.existsSync(TRANSCRIPTS_DIR)) {
      const files = await fs.promises.readdir(TRANSCRIPTS_DIR);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(TRANSCRIPTS_DIR, file);
          seenPaths.add(filePath);
          try {
            const stat = await fs.promises.stat(filePath);
            const mtime = stat.mtimeMs;
            const size = stat.size;

            const cached = cache.files[filePath];
            // Skip cache read if nlpEngine is active to ensure fresh LLM extraction, or if file changed
            if (!nlpEngine && cached && cached.mtime === mtime && cached.size === size) {
              allChunks.push(...cached.chunks);
              hitCount++;
            } else {
              const chunks = await this.parseTranscript(filePath, file, nlpEngine, errorContainer);
              cache.files[filePath] = { mtime, size, chunks };
              cacheDirty = true;
              allChunks.push(...chunks);
              missCount++;
            }
          } catch (err) {
            console.error(`❌ Error processing transcript file ${file}:`, err);
          }
        }
      }
    }

    // 2. Ingest Office Documents (.docx/.doc, .pptx/.ppt, .xlsx/.xls) - Including legacy binary formats
    if (fs.existsSync(DOCUMENTS_DIR)) {
      const files = await fs.promises.readdir(DOCUMENTS_DIR);

      // Allowed extensions mapped to their parser type
      const extensionMap: Record<string, 'docx' | 'pptx' | 'xlsx'> = {
        '.docx': 'docx', '.doc': 'docx',
        '.pptx': 'pptx', '.ppt': 'pptx',
        '.xlsx': 'xlsx', '.xls': 'xlsx',
      };

      // Security: Maximum file size (50MB) to prevent resource exhaustion from oversized uploads
      const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const parserType = extensionMap[ext];
        if (!parserType) continue;

        const filePath = path.join(DOCUMENTS_DIR, file);
        seenPaths.add(filePath);
        try {
          const stat = await fs.promises.stat(filePath);
          const mtime = stat.mtimeMs;
          const size = stat.size;

          // Security: Reject oversized files to prevent memory exhaustion or denial-of-service
          if (size > MAX_FILE_SIZE_BYTES) {
            console.warn(`🛡️ Security: Skipping oversized file "${file}" (${(size / 1024 / 1024).toFixed(1)}MB exceeds 50MB limit).`);
            continue;
          }

          // Security: Basic magic-byte validation to detect disguised or corrupted files
          const fd = await fs.promises.open(filePath, 'r');
          const headerBuf = Buffer.alloc(8);
          await fd.read(headerBuf, 0, 8, 0);
          await fd.close();

          const isZipBased = headerBuf[0] === 0x50 && headerBuf[1] === 0x4B; // PK header (.docx/.pptx/.xlsx)
          const isOleBased = headerBuf[0] === 0xD0 && headerBuf[1] === 0xCF && headerBuf[2] === 0x11 && headerBuf[3] === 0xE0; // OLE2 header (.doc/.ppt/.xls)

          if (!isZipBased && !isOleBased) {
            console.warn(`🛡️ Security: Skipping file "${file}" — file header does not match any known Office format (expected ZIP/PK or OLE2/CFB signature). File may be corrupted or disguised.`);
            continue;
          }

          const cached = cache.files[filePath];
          // Skip cache read if nlpEngine is active to ensure fresh LLM extraction, or if file changed
          if (!nlpEngine && cached && cached.mtime === mtime && cached.size === size) {
            allChunks.push(...cached.chunks);
            hitCount++;
          } else {
            let chunks: DocumentChunk[] = [];
            if (parserType === 'docx') {
              chunks = await this.parseDocx(filePath, file, nlpEngine, errorContainer);
            } else if (parserType === 'pptx') {
              chunks = await this.parsePptx(filePath, file, nlpEngine, errorContainer);
            } else if (parserType === 'xlsx') {
              chunks = await this.parseXlsx(filePath, file, nlpEngine, errorContainer);
            }
            cache.files[filePath] = { mtime, size, chunks };
            cacheDirty = true;
            allChunks.push(...chunks);
            missCount++;
          }
        } catch (err) {
          console.error(`❌ Error processing document file ${file}:`, err);
        }
      }
    }

    // Prune deleted/disabled files from the cache automatically
    for (const cachedPath of Object.keys(cache.files)) {
      if (!seenPaths.has(cachedPath)) {
        delete cache.files[cachedPath];
        cacheDirty = true;
      }
    }

    // Write updated cache if dirty
    if (cacheDirty) {
      try {
        await safeWriteJson(CACHE_PATH, cache);
        console.log(`💾 Ingestion cache updated and pruned at: ${CACHE_PATH}`);
      } catch (err) {
        console.error("❌ Failed to write ingestion cache:", err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🚀 Ingestion complete: loaded ${allChunks.length} chunks. (Total Time: ${duration}ms | Cache Hits: ${hitCount} | Cache Misses/Parsed: ${missCount})`);

    return allChunks;
  }

  /**
   * Parses Markdown transcripts and extracts frontmatter attributes.
   */
  private async parseTranscript(filePath: string, fileName: string, nlpEngine?: INLPEngine, errorContainer?: { cloudError?: any }): Promise<DocumentChunk[]> {
    const rawContent = await fs.promises.readFile(filePath, 'utf-8');
    const contentLower = rawContent.toLowerCase();

    // 1. Dynamic Date Extraction Heuristics (from filename YYYY_MM_DD)
    let date = '2026-05-20';
    const dateMatch = fileName.match(/(\d{4})_(\d{2})_(\d{2})/);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }

    // 2. Dynamic Attendees/Speakers Extraction Heuristics
    const speakerRegex = /^\*\*([^*:]+)\*\*:/gm;
    const uniqueSpeakers = new Set<string>();
    let match;
    let firstSpeaker = '';

    speakerRegex.lastIndex = 0;
    while ((match = speakerRegex.exec(rawContent)) !== null) {
      const name = match[1].trim();
      if (name) {
        uniqueSpeakers.add(name);
        if (!firstSpeaker) {
          firstSpeaker = name;
        }
      }
    }
    let attendees: string[] = Array.from(uniqueSpeakers);

    // 3. Dynamic Topic Domain Categorization Heuristics
    let domain = 'General';
    if (contentLower.includes('quantum') || contentLower.includes('temporal fusion') || contentLower.includes('forecasting') || contentLower.includes('mae')) {
      domain = 'Project Quantum';
    } else if (contentLower.includes('helium') || contentLower.includes('sensor') || contentLower.includes('overheating') || contentLower.includes('chassis') || contentLower.includes('fan')) {
      domain = 'Project Helium';
    } else if (contentLower.includes('horizon') || contentLower.includes('microgrid') || contentLower.includes('discharge') || contentLower.includes('solar')) {
      domain = 'Project Horizon';
    } else if (contentLower.includes('database') || contentLower.includes('postgresql') || contentLower.includes('timescaledb') || contentLower.includes('scaling') || contentLower.includes('lock')) {
      domain = 'DevOps / Database';
    } else if (contentLower.includes('compliance') || contentLower.includes('safety') || contentLower.includes('arc flash') || contentLower.includes('sop')) {
      domain = 'Safety & Compliance';
    } else if (contentLower.includes('pricing') || contentLower.includes('gridpulse') || contentLower.includes('commercials') || contentLower.includes('licensing') || contentLower.includes('tier')) {
      domain = 'Product Commercials';
    } else if (contentLower.includes('roadmap') || contentLower.includes('milestone') || contentLower.includes('tech roadmap')) {
      domain = 'Product Roadmap';
    } else if (contentLower.includes('simulation') || contentLower.includes('solar flare') || contentLower.includes('emp') || contentLower.includes('resilience')) {
      domain = 'AI Testing / Grid Simulation';
    }

    // 4. Dynamic Priority Severity Rating Heuristics
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (
      contentLower.includes('crisis') ||
      contentLower.includes('blocker') ||
      contentLower.includes('emergency') ||
      contentLower.includes('disaster') ||
      contentLower.includes('danger') ||
      contentLower.includes('lock up') ||
      contentLower.includes('91°c') ||
      contentLower.includes('spike') ||
      contentLower.includes('critical')
    ) {
      priority = 'High';
    } else if (
      contentLower.includes('warning') ||
      contentLower.includes('milestone') ||
      contentLower.includes('kickoff') ||
      contentLower.includes('sop') ||
      contentLower.includes('alignment') ||
      contentLower.includes('design')
    ) {
      priority = 'Medium';
    } else {
      priority = 'Low';
    }

    let facilitator = firstSpeaker;

    // Backward-Compatible Frontmatter Support
    const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let cleanContent = rawContent;

    if (frontmatterMatch) {
      cleanContent = rawContent.replace(frontmatterMatch[0], '').trim();
      const yamlLines = frontmatterMatch[1].split('\n');
      for (const line of yamlLines) {
        const [key, ...valParts] = line.split(':');
        if (!key || valParts.length === 0) continue;
        const val = valParts.join(':').trim();

        const k = key.trim();
        if (k === 'date') date = val;
        else if (k === 'domain') domain = val;
        else if (k === 'priority') {
          priority = (val as any) || 'Medium';
        } else if (k === 'attendees') {
          attendees = val.split(',').map(s => s.trim());
        } else if (k === 'facilitator') {
          facilitator = val;
        }
      }
    }

    const author = facilitator || attendees[0] || 'Unknown Attendee';

    // Enrich using cloud LLM if requested
    const meta = await this.enrichMetadata(fileName, rawContent, nlpEngine, errorContainer, {
      domain,
      priority,
      author,
      attendees
    });

    // Chunking: Split into paragraphs for semantic index
    const paragraphs = cleanContent.split(/\r?\n\r?\n/).filter(p => p.trim().length > 10);
    
    return paragraphs.map((para, index) => ({
      id: `${fileName}_chunk_${index}`,
      filePath: virtualizePath(filePath),
      fileName,
      fileType: 'transcript',
      content: para.trim(),
      author: meta.author || author,
      attendees: meta.attendees || attendees,
      date,
      domain: meta.domain || domain,
      priority: meta.priority || priority,
      decisions: meta.decisions,
      actionItems: meta.actionItems
    }));
  }

  /**
   * Parses Word documents (.docx) using mammoth.
   */
  private async parseDocx(filePath: string, fileName: string, nlpEngine?: INLPEngine, errorContainer?: { cloudError?: any }): Promise<DocumentChunk[]> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;

      // Extract metadata from text layout
      let author = 'Unknown Author';
      let date = '2026-05-20';
      let domain = 'General';
      let priority: 'High' | 'Medium' | 'Low' = 'Medium';

      const authorMatch = text.match(/Author:\s*([^\r\n]+)/i);
      const dateMatch = text.match(/Date:\s*([^\r\n]+)/i);

      if (authorMatch) author = authorMatch[1].trim();
      if (dateMatch) date = dateMatch[1].trim();

      if (fileName.includes('quantum')) {
        domain = 'Project Quantum';
        priority = 'High';
      } else if (fileName.includes('helium')) {
        domain = 'Project Helium';
        priority = 'High';
      } else if (fileName.includes('devops') || fileName.includes('infrastructure')) {
        domain = 'DevOps / Infrastructure';
        priority = 'Medium';
      } else if (fileName.includes('sop') || fileName.includes('compliance')) {
        domain = 'Safety & Compliance';
        priority = 'Medium';
      }

      // Enrich using cloud LLM if requested
      const meta = await this.enrichMetadata(fileName, text, nlpEngine, errorContainer, {
        domain,
        priority,
        author
      });

      // Chunk by paragraph/section
      const sections = text.split(/\r?\n\r?\n/).filter(s => s.trim().length > 20);
      return sections.map((sect, index) => ({
        id: `${fileName}_chunk_${index}`,
        filePath: virtualizePath(filePath),
        fileName,
        fileType: 'docx',
        content: sect.trim(),
        author: meta.author || author,
        attendees: meta.attendees || [],
        date,
        domain: meta.domain || domain,
        priority: meta.priority || priority,
        decisions: meta.decisions,
        actionItems: meta.actionItems
      }));
    } catch (err) {
      console.error(`Error parsing Word docx: ${fileName}`, err);
      return [];
    }
  }

  /**
   * Parses PowerPoint slides (.pptx) using officeparser.
   */
  private async parsePptx(filePath: string, fileName: string, nlpEngine?: INLPEngine, errorContainer?: { cloudError?: any }): Promise<DocumentChunk[]> {
    return new Promise((resolve) => {
      officeParser.parseOffice(filePath, async (data: string | Error) => {
        if (data instanceof Error) {
          console.error(`Error parsing PPTX: ${fileName}`, data);
          return resolve([]);
        }

        let author = 'Sarah Chen';
        let date = '2026-05-01';
        let domain = 'Product Commercials';
        let priority: 'High' | 'Medium' | 'Low' = 'Medium';

        if (fileName.includes('horizon')) {
          domain = 'Project Horizon';
          author = 'Amira Patel';
        } else if (fileName.includes('helium')) {
          domain = 'Project Helium';
          author = 'Marcus Vance';
          priority = 'High';
        } else if (fileName.includes('quantum')) {
          domain = 'Project Quantum';
          author = 'Dr. Elena Rostova';
          priority = 'High';
        }

        // Enrich using cloud LLM if requested
        const meta = await this.enrichMetadata(fileName, data, nlpEngine, errorContainer, {
          domain,
          priority,
          author
        });

        const slides = data.split(/\r?\n\r?\n/).filter(s => s.trim().length > 15);
        
        const chunks = slides.map((slideText, index) => ({
          id: `${fileName}_chunk_${index}`,
          filePath: virtualizePath(filePath),
          fileName,
          fileType: 'pptx' as const,
          content: slideText.trim(),
          author: meta.author || author,
          attendees: meta.attendees || [],
          date,
          domain: meta.domain || domain,
          priority: meta.priority || priority,
          decisions: meta.decisions,
          actionItems: meta.actionItems
        }));

        resolve(chunks);
      });
    });
  }

  /**
   * Parses Excel sheets (.xlsx) row-by-row using SheetJS.
   */
  private async parseXlsx(filePath: string, fileName: string, nlpEngine?: INLPEngine, errorContainer?: { cloudError?: any }): Promise<DocumentChunk[]> {
    try {
      const workbook = xlsx.readFile(filePath);
      const rawSheetsData: Array<{ sheetName: string; lines: string[]; author: string; date: string; domain: string; priority: 'High' | 'Medium' | 'Low' }> = [];

      let combinedText = '';
      let defaultAuthor = 'Unknown';
      let defaultDate = '2026-05-20';
      let defaultDomain = 'Product Commercials';
      let defaultPriority: 'High' | 'Medium' | 'Low' = 'Medium';

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON array
        const rawRows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (rawRows.length === 0) continue;

        // Parse Metadata Block
        let author = 'Unknown';
        let date = '2026-05-20';
        let dataStartRow = 0;

        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
          const row = rawRows[i];
          if (row && row[0] && typeof row[0] === 'string') {
            if (row[0].includes('Author:')) {
              author = row[0].replace('Author:', '').trim();
            } else if (row[0].includes('Date:')) {
              date = row[0].replace('Date:', '').trim();
            }
          }
          if (row.length > 1 && rawRows[i - 1]?.length === 0) {
            dataStartRow = i;
          }
        }

        if (dataStartRow === 0) {
          dataStartRow = rawRows.findIndex(r => r.length > 1);
          if (dataStartRow === -1) dataStartRow = 0;
        }

        let domain = 'Product Commercials';
        let priority: 'High' | 'Medium' | 'Low' = 'Medium';
        if (fileName.includes('quantum')) {
          domain = 'Project Quantum';
          priority = 'High';
        } else if (fileName.includes('thermal') || fileName.includes('helium')) {
          domain = 'Project Helium';
          priority = 'High';
        } else if (fileName.includes('capacity') || fileName.includes('infrastructure')) {
          domain = 'DevOps / Infrastructure';
          priority = 'Medium';
        }

        if (author !== 'Unknown') defaultAuthor = author;
        if (date !== '2026-05-20') defaultDate = date;
        defaultDomain = domain;
        defaultPriority = priority;

        const headerRow = rawRows[dataStartRow] || [];
        const contentRows = rawRows.slice(dataStartRow + 1);

        const sheetLines: string[] = [];
        for (const row of contentRows) {
          if (!row || row.length === 0) continue;
          const rowParts: string[] = [];
          for (let colIdx = 0; colIdx < Math.max(row.length, headerRow.length); colIdx++) {
            const h = headerRow[colIdx] || `Col_${colIdx}`;
            const val = row[colIdx] !== undefined ? row[colIdx] : '';
            if (val !== '') {
              rowParts.push(`${h}: ${val}`);
            }
          }
          if (rowParts.length > 0) {
            sheetLines.push(rowParts.join(', '));
          }
        }

        if (sheetLines.length > 0) {
          rawSheetsData.push({
            sheetName,
            lines: sheetLines,
            author,
            date,
            domain,
            priority
          });
          combinedText += `Sheet: "${sheetName}" | Tabular Data:\n` + sheetLines.join(';\n') + '\n\n';
        }
      }

      // Enrich once for the entire workbook
      const meta = await this.enrichMetadata(fileName, combinedText, nlpEngine, errorContainer, {
        domain: defaultDomain,
        priority: defaultPriority,
        author: defaultAuthor
      });

      const chunks: DocumentChunk[] = [];
      for (const sheetData of rawSheetsData) {
        chunks.push({
          id: `${fileName}_${sheetData.sheetName}_chunk`,
          filePath: virtualizePath(filePath),
          fileName,
          fileType: 'xlsx',
          content: `Sheet: "${sheetData.sheetName}" | Tabular Data:\n` + sheetData.lines.join(';\n'),
          author: meta.author || sheetData.author,
          attendees: meta.attendees || [],
          date: sheetData.date,
          domain: meta.domain || sheetData.domain,
          priority: meta.priority || sheetData.priority,
          decisions: meta.decisions,
          actionItems: meta.actionItems
        });
      }

      return chunks;
    } catch (err) {
      console.error(`Error parsing Excel: ${fileName}`, err);
      return [];
    }
  }
}
export const parserService = new ParserService();
