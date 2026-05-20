import { QueryResponse, SuggestedRouting } from './nlp';

export interface ExpertProfile {
  name: string;
  email: string;
  domain: string;
  role: string;
  details: string;
}

// System Expert Directory
export const EXPERT_DIRECTORY: ExpertProfile[] = [
  {
    name: 'Dr. Elena Rostova',
    email: 'elena@aethergrid.com',
    domain: 'Project Quantum',
    role: 'Chief Scientist & AI Architect',
    details: 'Author of the Quantum ML forecasting specification, creator of neural TFT models, and leader of model training audits.'
  },
  {
    name: 'Marcus Vance',
    email: 'marcus@aethergrid.com',
    domain: 'Project Helium',
    role: 'VP of Engineering',
    details: 'Author of the Helium edge node enclosure hardware design, thermal test manager, and substation antenna bracket designer.'
  },
  {
    name: 'Sarah Chen',
    email: 'sarah@aethergrid.com',
    domain: 'Product Commercials',
    role: 'Director of Product',
    details: 'Creator of the GridPulse pricing matrix, standard licensing tiers, and client onboarding roadmap reviewer.'
  },
  {
    name: 'David Kross',
    email: 'david@aethergrid.com',
    domain: 'DevOps / Infrastructure',
    role: 'Lead DevOps & Infrastructure',
    details: 'Writer of edge Kubernetes scaling specifications, designer of active container synchronization, and TimescaleDB scaling manager.'
  },
  {
    name: 'Amira Patel',
    email: 'amira@aethergrid.com',
    domain: 'Project Horizon',
    role: 'Senior Grid Engineer',
    details: 'Author of microgrid integration presentations, developer of community solar batteries discharge rules, and compliance auditor.'
  }
];

export class RoutingService {
  /**
   * Appends suggested expert routing to a query response if confidence is low.
   */
  public generateRouting(query: string, domain: string): SuggestedRouting {
    const queryLower = query.toLowerCase();

    // 1. Match expert by query keywords
    let matchedExpert = EXPERT_DIRECTORY.find(e => e.domain.toLowerCase() === domain.toLowerCase());

    if (!matchedExpert) {
      // Fallback keyword scanning
      if (queryLower.includes('quantum') || queryLower.includes('forecast') || queryLower.includes('predict') || queryLower.includes('mae') || queryLower.includes('elena')) {
        matchedExpert = EXPERT_DIRECTORY[0]; // Elena
      } else if (queryLower.includes('helium') || queryLower.includes('enclosure') || queryLower.includes('thermal') || queryLower.includes('chassis') || queryLower.includes('marcus')) {
        matchedExpert = EXPERT_DIRECTORY[1]; // Marcus
      } else if (queryLower.includes('price') || queryLower.includes('license') || queryLower.includes('pricing') || queryLower.includes('sarah') || queryLower.includes('cost')) {
        matchedExpert = EXPERT_DIRECTORY[2]; // Sarah
      } else if (queryLower.includes('kubernetes') || queryLower.includes('k3s') || queryLower.includes('database') || queryLower.includes('postgre') || queryLower.includes('scaling') || queryLower.includes('david')) {
        matchedExpert = EXPERT_DIRECTORY[3]; // David
      } else if (queryLower.includes('horizon') || queryLower.includes('microgrid') || queryLower.includes('battery') || queryLower.includes('solar') || queryLower.includes('amira')) {
        matchedExpert = EXPERT_DIRECTORY[4]; // Amira
      } else {
        // Absolute fallback to VP of Engineering
        matchedExpert = EXPERT_DIRECTORY[1]; // Marcus
      }
    }

    // 2. Draft customized rationale
    const rationale = `${matchedExpert.name} is the designated topic expert for ${matchedExpert.domain}. She is the ${matchedExpert.role} at AetherGrid Technologies and is the primary contributor for all technical designs, meeting decisions, and compliance standards relating to this domain.`;

    // 3. Draft customized Slack/Email question
    const queryTopic = query.replace(/[?.]/g, '').trim();
    const draftedQuestion = `Hi ${matchedExpert.name.split(' ')[0]},\n\nI was trying to find information regarding: "${queryTopic}". Our automated knowledge tracer yielded low confidence. Since you are our Topic Expert for ${matchedExpert.domain} and have led our technical specs in this area, could you help clarify this? Let me know if we can sync on Slack.\n\nThanks!`;

    return {
      recipientName: matchedExpert.name,
      recipientEmail: matchedExpert.email,
      rationale,
      draftedQuestion
    };
  }
}
export const routingService = new RoutingService();
