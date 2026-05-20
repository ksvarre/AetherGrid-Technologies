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

export class ParserService {
  /**
   * Main entry point: Scans directories, parses files, and returns semantic chunks.
   */
  public async ingestAll(): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];

    // 1. Ingest Transcripts (.md)
    if (fs.existsSync(TRANSCRIPTS_DIR)) {
      const files = await fs.promises.readdir(TRANSCRIPTS_DIR);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(TRANSCRIPTS_DIR, file);
          const chunks = await this.parseTranscript(filePath, file);
          allChunks.push(...chunks);
        }
      }
    }

    // 2. Ingest Office Documents (.docx, .pptx, .xlsx)
    if (fs.existsSync(DOCUMENTS_DIR)) {
      const files = await fs.promises.readdir(DOCUMENTS_DIR);
      for (const file of files) {
        const filePath = path.join(DOCUMENTS_DIR, file);
        if (file.endsWith('.docx')) {
          const chunks = await this.parseDocx(filePath, file);
          allChunks.push(...chunks);
        } else if (file.endsWith('.pptx')) {
          const chunks = await this.parsePptx(filePath, file);
          allChunks.push(...chunks);
        } else if (file.endsWith('.xlsx')) {
          const chunks = await this.parseXlsx(filePath, file);
          allChunks.push(...chunks);
        }
      }
    }

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
      filePath,
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
        filePath,
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
          filePath,
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
            filePath,
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
