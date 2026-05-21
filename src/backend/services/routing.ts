import { QueryResponse, SuggestedRouting, DocumentChunk } from './nlp';

export interface ExpertProfile {
  name: string;
  email: string;
  domain: string;
  role: string;
  pronoun: 'He' | 'She' | 'They';
  details: string;
}

// System Expert Directory
export const EXPERT_DIRECTORY: ExpertProfile[] = [
  {
    name: 'Dr. Elena Rostova',
    email: 'elena@aethergrid.com',
    domain: 'Project Quantum',
    role: 'Chief Scientist & AI Architect',
    pronoun: 'She',
    details: 'Author of the Quantum ML forecasting specification, creator of neural TFT models, and leader of model training audits.'
  },
  {
    name: 'Marcus Vance',
    email: 'marcus@aethergrid.com',
    domain: 'Project Helium',
    role: 'VP of Engineering',
    pronoun: 'He',
    details: 'Author of the Helium edge node enclosure hardware design, thermal test manager, and substation antenna bracket designer.'
  },
  {
    name: 'Sarah Chen',
    email: 'sarah@aethergrid.com',
    domain: 'Product Commercials',
    role: 'Director of Product',
    pronoun: 'She',
    details: 'Creator of the GridPulse pricing matrix, standard licensing tiers, and client onboarding roadmap reviewer.'
  },
  {
    name: 'David Kross',
    email: 'david@aethergrid.com',
    domain: 'DevOps / Infrastructure',
    role: 'Lead DevOps & Infrastructure',
    pronoun: 'He',
    details: 'Writer of edge Kubernetes scaling specifications, designer of active container synchronization, and TimescaleDB scaling manager.'
  },
  {
    name: 'Amira Patel',
    email: 'amira@aethergrid.com',
    domain: 'Project Horizon',
    role: 'Senior Grid Engineer',
    pronoun: 'She',
    details: 'Author of microgrid integration presentations, developer of community solar batteries discharge rules, and compliance auditor.'
  }
];

/**
 * Domain keyword map used to detect if a query is even remotely related to
 * AetherGrid's knowledge domains. Used to differentiate Tier 2 (domain-related
 * but no match) from Tier 3 (completely off-topic).
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'Project Quantum': ['quantum', 'forecast', 'predict', 'mae', 'neural', 'model', 'ml', 'elena', 'rostova', 'tft', 'training'],
  'Project Helium': ['helium', 'enclosure', 'thermal', 'chassis', 'edge', 'sensor', 'antenna', 'firmware', 'hardware', 'marcus', 'vance', 'substation'],
  'Product Commercials': ['price', 'pricing', 'license', 'tier', 'cost', 'commercial', 'gridpulse', 'sarah', 'chen', 'onboarding'],
  'DevOps / Infrastructure': ['kubernetes', 'k3s', 'database', 'postgre', 'timescale', 'scaling', 'container', 'deploy', 'david', 'kross', 'devops', 'infrastructure'],
  'Project Horizon': ['horizon', 'microgrid', 'battery', 'solar', 'discharge', 'compliance', 'amira', 'patel', 'grid', 'community'],
};

export class RoutingService {
  /**
   * Three-tier intelligent routing:
   *
   *  Tier 1 — Domain match + content snippet found
   *    → Route to expert with snippet-level rationale ("The closest match was X from doc Y")
   *
   *  Tier 2 — Domain keywords detected in query but zero/very-low corpus match
   *    → Route to domain expert with honest "no matching content found" disclosure
   *
   *  Tier 3 — Completely off-topic (no domain keywords, no content overlap)
   *    → Return null (don't route). The UI will show an "out of scope" message instead.
   */
  public generateRouting(query: string, domain: string, topMatchedChunks?: DocumentChunk[]): SuggestedRouting | null {
    const queryLower = query.toLowerCase();
    const hasContentMatch = topMatchedChunks && topMatchedChunks.length > 0;

    // 1. Try exact domain match from NLP engine
    let matchedExpert = EXPERT_DIRECTORY.find(e => e.domain.toLowerCase() === domain.toLowerCase());
    let matchedViaDomainKeyword = false;

    if (!matchedExpert || matchedExpert.domain === 'General') {
      // 2. Keyword scan across all domain vocabularies
      for (const [domainName, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        if (keywords.some(kw => queryLower.includes(kw))) {
          matchedExpert = EXPERT_DIRECTORY.find(e => e.domain === domainName);
          matchedViaDomainKeyword = true;
          break;
        }
      }
    }

    // TIER 3: Completely off-topic — no domain keyword match AND no content match
    if (!matchedExpert && !hasContentMatch) {
      return null; // Signal to the UI: show "out of scope" instead of a forced routing
    }

    // If still no expert but we have content matches, use the content's domain to find one
    if (!matchedExpert && hasContentMatch) {
      const contentDomain = topMatchedChunks![0].domain;
      matchedExpert = EXPERT_DIRECTORY.find(e => e.domain.toLowerCase() === contentDomain?.toLowerCase()) || EXPERT_DIRECTORY[1];
    }

    // Safety net (should never reach here but TypeScript requires it)
    if (!matchedExpert) {
      matchedExpert = EXPERT_DIRECTORY[1]; // VP of Engineering
    }

    // 3. Build tiered rationale
    let rationale = '';

    if (hasContentMatch) {
      // TIER 1: Content snippet found — explain what was found and why this expert
      const topChunk = topMatchedChunks![0];
      const snippet = topChunk.content.length > 120 ? topChunk.content.substring(0, 120) + '...' : topChunk.content;
      rationale = `The closest matching content found was from "${topChunk.fileName}" (authored by ${topChunk.author}): "${snippet}". However, the match confidence was below the 40% reliability threshold. ${matchedExpert.name} is the designated topic expert for ${matchedExpert.domain}. ${matchedExpert.pronoun} is the ${matchedExpert.role} at AetherGrid Technologies and is the primary contributor for all technical designs, meeting decisions, and compliance standards relating to this domain.`;
    } else {
      // TIER 2: Domain keyword matched but no corpus content found
      rationale = `No matching content was found in the knowledge base for this query. However, the query contains keywords associated with the "${matchedExpert.domain}" domain. ${matchedExpert.name} is the designated topic expert for this area. ${matchedExpert.pronoun} is the ${matchedExpert.role} at AetherGrid Technologies and may be able to provide guidance or identify where this information should be documented.`;
    }

    // 4. Draft customized Microsoft Teams question
    const queryTopic = query.replace(/[?.]/g, '').trim();
    const draftedQuestion = `Hi ${matchedExpert.name.split(' ')[0]},\n\nI was trying to find information regarding: "${queryTopic}". Our automated knowledge tracer yielded low confidence. Since you are our Topic Expert for ${matchedExpert.domain} and have led our technical specs in this area, could you help clarify this? Let me know if we can sync on Teams.\n\nThanks!`;

    return {
      recipientName: matchedExpert.name,
      recipientEmail: matchedExpert.email,
      rationale,
      draftedQuestion
    };
  }
}
export const routingService = new RoutingService();
