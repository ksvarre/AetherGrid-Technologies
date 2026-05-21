import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import officeParser from 'officeparser';
import { DocumentChunk } from './nlp';

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
   * Main entry point: Scans directories, parses files, and returns semantic chunks.
   */
  public async ingestAll(): Promise<DocumentChunk[]> {
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
            if (cached && cached.mtime === mtime && cached.size === size) {
              allChunks.push(...cached.chunks);
              hitCount++;
            } else {
              const chunks = await this.parseTranscript(filePath, file);
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

    // 2. Ingest Office Documents (.docx, .pptx, .xlsx)
    if (fs.existsSync(DOCUMENTS_DIR)) {
      const files = await fs.promises.readdir(DOCUMENTS_DIR);
      for (const file of files) {
        const filePath = path.join(DOCUMENTS_DIR, file);
        if (file.endsWith('.docx') || file.endsWith('.pptx') || file.endsWith('.xlsx')) {
          seenPaths.add(filePath);
          try {
            const stat = await fs.promises.stat(filePath);
            const mtime = stat.mtimeMs;
            const size = stat.size;

            const cached = cache.files[filePath];
            if (cached && cached.mtime === mtime && cached.size === size) {
              allChunks.push(...cached.chunks);
              hitCount++;
            } else {
              let chunks: DocumentChunk[] = [];
              if (file.endsWith('.docx')) {
                chunks = await this.parseDocx(filePath, file);
              } else if (file.endsWith('.pptx')) {
                chunks = await this.parsePptx(filePath, file);
              } else if (file.endsWith('.xlsx')) {
                chunks = await this.parseXlsx(filePath, file);
              }
              cache.files[filePath] = { mtime, size, chunks };
              cacheDirty = true;
              allChunks.push(...chunks);
              missCount++;
            }
          } catch (err) {
            console.error(`❌ Error processing office file ${file}:`, err);
          }
        }
      }
    }

    // Prune deleted files from the cache
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
        console.log(`💾 Ingestion cache updated at: ${CACHE_PATH}`);
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
  private async parseTranscript(filePath: string, fileName: string): Promise<DocumentChunk[]> {
    const rawContent = await fs.promises.readFile(filePath, 'utf-8');

    // Parse Frontmatter
    let date = '2026-05-20';
    let attendees: string[] = [];
    let domain = 'General';
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';

    const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let cleanContent = rawContent;

    if (frontmatterMatch) {
      cleanContent = rawContent.replace(frontmatterMatch[0], '').trim();
      const yamlLines = frontmatterMatch[1].split('\n');
      for (const line of yamlLines) {
        const [key, ...valParts] = line.split(':');
        if (!key || valParts.length === 0) continue;
        const val = valParts.join(':').trim();

        if (key.trim() === 'date') date = val;
        else if (key.trim() === 'domain') domain = val;
        else if (key.trim() === 'priority') {
          priority = (val as any) || 'Medium';
        } else if (key.trim() === 'attendees') {
          attendees = val.split(',').map(s => s.trim());
        }
      }
    }

    // Identify author (Facilitator or First Attendee)
    const author = attendees[0] || 'Unknown Attendee';

    // Chunking: Split into paragraphs for semantic index
    const paragraphs = cleanContent.split(/\r?\n\r?\n/).filter(p => p.trim().length > 10);
    
    return paragraphs.map((para, index) => ({
      id: `${fileName}_chunk_${index}`,
      filePath: virtualizePath(filePath),
      fileName,
      fileType: 'transcript',
      content: para.trim(),
      author,
      attendees,
      date,
      domain,
      priority
    }));
  }

  /**
   * Parses Word documents (.docx) using mammoth.
   */
  private async parseDocx(filePath: string, fileName: string): Promise<DocumentChunk[]> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;

      // Extract metadata from text layout
      let author = 'Unknown Author';
      let date = '2026-05-20';
      let domain = 'General';
      let priority: 'High' | 'Medium' | 'Low' = 'Medium';

      // Parse metadata block if present (e.g. "Author: Dr. Elena Rostova")
      const authorMatch = text.match(/Author:\s*([^\r\n]+)/i);
      const dateMatch = text.match(/Date:\s*([^\r\n]+)/i);

      if (authorMatch) author = authorMatch[1].trim();
      if (dateMatch) date = dateMatch[1].trim();

      // Deduce domain and priority from file title/words
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

      // Chunk by paragraph/section
      const sections = text.split(/\r?\n\r?\n/).filter(s => s.trim().length > 20);
      return sections.map((sect, index) => ({
        id: `${fileName}_chunk_${index}`,
        filePath: virtualizePath(filePath),
        fileName,
        fileType: 'docx',
        content: sect.trim(),
        author,
        attendees: [],
        date,
        domain,
        priority
      }));
    } catch (err) {
      console.error(`Error parsing Word docx: ${fileName}`, err);
      return [];
    }
  }

  /**
   * Parses PowerPoint slides (.pptx) using officeparser.
   */
  private async parsePptx(filePath: string, fileName: string): Promise<DocumentChunk[]> {
    return new Promise((resolve) => {
      officeParser.parseOffice(filePath, (data: string | Error) => {
        if (data instanceof Error) {
          console.error(`Error parsing PPTX: ${fileName}`, data);
          return resolve([]);
        }

        let author = 'Sarah Chen';
        let date = '2026-05-01';
        let domain = 'Product Commercials';
        let priority: 'High' | 'Medium' | 'Low' = 'Medium';

        // Deduce details from file names
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

        // officeparser returns raw text separated by newlines
        // We will chunk slide contents. Typically slide elements are grouped.
        // We can split by double newlines or group every few lines as a slide.
        const slides = data.split(/\r?\n\r?\n/).filter(s => s.trim().length > 15);
        
        const chunks = slides.map((slideText, index) => ({
          id: `${fileName}_chunk_${index}`,
          filePath: virtualizePath(filePath),
          fileName,
          fileType: 'pptx' as const,
          content: slideText.trim(),
          author,
          attendees: [],
          date,
          domain,
          priority
        }));

        resolve(chunks);
      });
    });
  }

  /**
   * Parses Excel sheets (.xlsx) row-by-row using SheetJS.
   */
  private async parseXlsx(filePath: string, fileName: string): Promise<DocumentChunk[]> {
    try {
      const workbook = xlsx.readFile(filePath);
      const chunks: DocumentChunk[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON array
        const rawRows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (rawRows.length === 0) continue;

        // Parse Metadata Block (AetherGrid sheets have: Metadata Block, File, Author, Date in top rows)
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
          // The headers row usually follows an empty row
          if (row.length > 1 && rawRows[i - 1]?.length === 0) {
            dataStartRow = i;
          }
        }

        // If dataStartRow wasn't deduced, fallback to first non-metadata row
        if (dataStartRow === 0) {
          dataStartRow = rawRows.findIndex(r => r.length > 1);
          if (dataStartRow === -1) dataStartRow = 0;
        }

        // Deduce metadata
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

        // Convert the grid into structured searchable strings
        // Group row descriptions
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

        // Separate chunks per sheet (or groups of rows)
        if (sheetLines.length > 0) {
          chunks.push({
            id: `${fileName}_${sheetName}_chunk`,
            filePath: virtualizePath(filePath),
            fileName,
            fileType: 'xlsx',
            content: `Sheet: "${sheetName}" | Tabular Data:\n` + sheetLines.join(';\n'),
            author,
            attendees: [],
            date,
            domain,
            priority
          });
        }
      }

      return chunks;
    } catch (err) {
      console.error(`Error parsing Excel: ${fileName}`, err);
      return [];
    }
  }
}
export const parserService = new ParserService();
