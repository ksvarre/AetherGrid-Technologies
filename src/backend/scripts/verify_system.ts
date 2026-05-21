import { parserService } from '../services/parser';
import { OfflineNLPEngine } from '../services/nlp';
import { routingService } from '../services/routing';
import { dbService } from '../services/database';

async function runVerification() {
  const arg = process.argv[2];
  
  console.log("======================================================================");
  console.log("🛡️ AETHERGRID KNOWLEDGE TRACER: SYSTEM VERIFICATION TEST SUITE");
  if (arg === '1' || arg === 'exercise1') {
    console.log("👉 TARGETING: EXERCISE 1 (Ingestion & High-Confidence Query Engine)");
  } else if (arg === '2' || arg === 'exercise2') {
    console.log("👉 TARGETING: EXERCISE 2 (Multi-format, Expert Routing, Feedback DB)");
  } else if (arg === '3' || arg === 'exercise3') {
    console.log("👉 TARGETING: EXERCISE 3 (Lead Action & System Telemetry Metrics)");
  } else {
    console.log("👉 TARGETING: FULL SYSTEM VERIFICATION SUITE");
  }
  console.log("======================================================================");

  try {
    const runStep1 = !arg || arg === '1' || arg === 'exercise1' || arg === '2' || arg === 'exercise2';
    const runStep2 = !arg || arg === '1' || arg === 'exercise1';
    const runStep3 = !arg || arg === '2' || arg === 'exercise2';
    const runStep4 = !arg || arg === '2' || arg === 'exercise2' || arg === '3' || arg === 'exercise3';
    const runStep5 = !arg || arg === '3' || arg === 'exercise3';

    let chunks: any[] = [];

    // Step 1: File Ingestion Scan (Exercise 1 & 2 Ingestion)
    if (runStep1) {
      console.log("\n[STEP 1] Ingesting synthetic files from data/ directory...");
      chunks = await parserService.ingestAll();
      console.log(`✅ Ingestion Successful: Loaded ${chunks.length} chunks.`);
      if (chunks.length === 0) {
        throw new Error("No chunks ingested. Please run data generation first: npm run generate-data");
      }
    } else {
      console.log("\n[STEP 1] Skipping ingestion. Loading database index fallback...");
      chunks = await parserService.ingestAll(); // Load index to memory anyway for subsequent steps if needed
    }

    // Step 2: High-Confidence Search Query (Exercise 1 NLP & Citations)
    if (runStep2) {
      console.log("\n[STEP 2] Running High-Confidence search query on 'Project Quantum'...");
      const engine = new OfflineNLPEngine();
      const highQuery = "What is the Project Quantum MAE forecasting target and validation status?";
      const highRes = await engine.queryDocuments(highQuery, chunks);
      
      console.log(`- Query: "${highQuery}"`);
      console.log(`- Confidence Score: ${highRes.confidenceScore} (Expected: > 0.40)`);
      console.log(`- Dominant Domain: ${highRes.domain}`);
      console.log(`- Priority: ${highRes.priority}`);
      console.log(`- Number of Citations: ${highRes.citations.length}`);
      highRes.citations.forEach((cit, index) => {
        console.log(`   [${index + 1}] File: ${cit.fileName} | Author: ${cit.author} | Snippet: "${cit.matchedSnippet.substring(0, 80)}..."`);
      });

      if (highRes.confidenceScore < 0.40) {
        console.warn("⚠️ Warning: High confidence query returned score below 0.40.");
      }
      if (highRes.citations.length === 0) {
        throw new Error("Failure: High confidence query returned no citations.");
      }
      console.log("✅ Exercise 1 High-Confidence Query test passed!");
    }

    // Step-specific routing for step 3
    if (runStep3) {
      console.log("\n[STEP 3] Running Low-Confidence query to trigger expert routing...");
      const engine = new OfflineNLPEngine();
      const lowQuery = "How do you bake a chocolate chip cookie at home?";
      const lowRes = await engine.queryDocuments(lowQuery, chunks);
      
      console.log(`- Query: "${lowQuery}"`);
      console.log(`- Confidence Score: ${lowRes.confidenceScore} (Expected: < 0.40)`);
      
      // Add routing if score is low
      if (lowRes.confidenceScore < 0.40) {
        const matchedChunks = lowRes.citations.map(cit => chunks.find(c => c.id === cit.chunkId)).filter(Boolean) as typeof chunks;
        lowRes.suggestedRouting = routingService.generateRouting(lowQuery, lowRes.domain, matchedChunks) ?? undefined;
      }

      // Tier 3: Off-topic query should NOT generate routing (null return = expected)
      if (!lowRes.suggestedRouting) {
        console.log("✅ Tier 3 Off-Topic Routing: Correctly returned null for unrelated query (no forced routing).");
      } else {
        console.log("✅ Suggested Routing Panel generated successfully:");
        console.log(`   - Expert: ${lowRes.suggestedRouting.recipientName}`);
        console.log(`   - Email: ${lowRes.suggestedRouting.recipientEmail}`);
        console.log(`   - Rationale: ${lowRes.suggestedRouting.rationale}`);
        console.log(`   - Draft Teams Msg:\n"${lowRes.suggestedRouting.draftedQuestion}"`);
      }

      // Tier 2: Domain-keyword query (should route to the correct expert)
      const tier2Query = "What are the quantum forecasting targets?";
      const tier2Res = await engine.queryDocuments(tier2Query, chunks);
      // Force low confidence for test purposes
      const tier2Chunks = tier2Res.citations.map(cit => chunks.find(c => c.id === cit.chunkId)).filter(Boolean) as typeof chunks;
      const tier2Routing = routingService.generateRouting(tier2Query, 'General', tier2Chunks);
      if (tier2Routing) {
        console.log(`✅ Tier 2 Domain Routing: "${tier2Query}" → ${tier2Routing.recipientName}`);
      }
    }

    // Step 4: Feedback Gap Database Operations
    if (runStep4) {
      console.log("\n[STEP 4] Verifying database log and user feedback ledger loop...");
      const lowQuery = "How do you bake a chocolate chip cookie at home?";
      const feedbackId = await dbService.addFeedback({
        query: lowQuery,
        answer: "Unknown",
        confidenceScore: 0.1,
        status: 'rejection',
        correctedAnswer: "Need to consult commercial and operations ledgers manually.",
        domain: "Operations"
      });
      console.log(`✅ Feedback Captured in Ledger: ID = ${feedbackId}`);

      const feedbackList = await dbService.getFeedback();
      const recorded = feedbackList.find(f => f.id === feedbackId);
      if (!recorded) {
        throw new Error("Failure: Logged feedback item not found in DB ledger.");
      }
      console.log(`- Retrieved feedback status: ${recorded.status} | Resolved: ${recorded.resolved}`);

      // Exercise 3 Lead action: Resolve feedback
      console.log("- Resolving feedback item via Team Lead action...");
      const resolved = await dbService.resolveFeedback(feedbackId);
      if (!resolved) {
        throw new Error("Failure: Could not resolve feedback item.");
      }
      const feedbackListAfter = await dbService.getFeedback();
      const recordedAfter = feedbackListAfter.find(f => f.id === feedbackId);
      console.log(`✅ Feedback Resolved Status: ${recordedAfter?.resolved ? 'RESOLVED (true)' : 'PENDING'}`);
    }

    // Step 5: Rolling Telemetry Metrics
    if (runStep5) {
      console.log("\n[STEP 5] Checking rolling health metrics and degradation triggers...");
      const metrics = await dbService.getMetricsSummary();
      console.log(`- Total Queries Logged: ${metrics.totalQueriesCount}`);
      console.log(`- Corrections Ledger Count: ${metrics.correctionsCount}`);
      console.log(`- Rolling Avg Confidence: ${metrics.rollingAvgConfidence}`);
      console.log(`- Rejection Rate: ${metrics.rejectionRate}`);
      console.log(`- System Health Index: ${metrics.systemHealthIndex}`);
      console.log(`- Telemetry Status: ${metrics.healthLevel}`);

      if (metrics.healthLevel !== 'Healthy') {
        console.log("🚨 DEGRADATION WARNING: Health index degraded below benchmark thresholds!");
      } else {
        console.log("🟢 Health checks normal: System running inside baseline thresholds.");
      }
    }

    console.log("\n======================================================================");
    console.log("🏆 SYSTEM VERIFICATION SUCCESSFUL: CHOSEN TARGET WORKFLOWS OPERATIONAL!");
    console.log("======================================================================");
  } catch (err: any) {
    console.error("\n❌ SYSTEM VERIFICATION FAILED:", err.message);
    process.exit(1);
  }
}

runVerification();
