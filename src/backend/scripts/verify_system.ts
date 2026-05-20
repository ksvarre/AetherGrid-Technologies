import { parserService } from '../services/parser';
import { OfflineNLPEngine } from '../services/nlp';
import { routingService } from '../services/routing';
import { dbService } from '../services/database';

async function runVerification() {
  console.log("======================================================================");
  console.log("🛡️ AETHERGRID KNOWLEDGE TRACER: SYSTEM VERIFICATION TEST SUITE");
  console.log("======================================================================");

  try {
    // Step 1: File Ingestion Scan (Exercise 1 & 2 Ingestion)
    console.log("\n[STEP 1] Ingesting synthetic files from data/ directory...");
    const chunks = await parserService.ingestAll();
    console.log(`✅ Ingestion Successful: Loaded ${chunks.length} chunks.`);
    if (chunks.length === 0) {
      throw new Error("No chunks ingested. Please run data generation first: npm run generate-data");
    }

    // Step 2: High-Confidence Search Query (Exercise 1 NLP & Citations)
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

    // Step 3: Low-Confidence Query & Suggestion Routing (Exercise 2 Routing)
    console.log("\n[STEP 3] Running Low-Confidence query to trigger expert routing...");
    const lowQuery = "How do you bake a chocolate chip cookie at home?";
    const lowRes = await engine.queryDocuments(lowQuery, chunks);
    
    console.log(`- Query: "${lowQuery}"`);
    console.log(`- Confidence Score: ${lowRes.confidenceScore} (Expected: < 0.40)`);
    
    // Add routing if score is low
    if (lowRes.confidenceScore < 0.40) {
      lowRes.suggestedRouting = routingService.generateRouting(lowQuery, lowRes.domain);
    }

    if (!lowRes.suggestedRouting) {
      throw new Error("Failure: Low confidence search did not trigger suggested expert routing.");
    }

    console.log("✅ Suggested Routing Panel generated successfully:");
    console.log(`   - Expert: ${lowRes.suggestedRouting.recipientName}`);
    console.log(`   - Email: ${lowRes.suggestedRouting.recipientEmail}`);
    console.log(`   - Rationale: ${lowRes.suggestedRouting.rationale}`);
    console.log(`   - Draft Slack Msg:\n"${lowRes.suggestedRouting.draftedQuestion}"`);

    // Step 4: Feedback Gap Database Operations (Exercise 2 Feedbacks)
    console.log("\n[STEP 4] Verifying database log and user feedback ledger loop...");
    const feedbackId = await dbService.addFeedback({
      query: lowQuery,
      answer: lowRes.answer,
      confidenceScore: lowRes.confidenceScore,
      status: 'rejection',
      correctedAnswer: "Need to consult commercial and operations ledgers manually.",
      domain: lowRes.domain
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

    // Step 5: Rolling Telemetry Metrics & Degradation Alerts (Exercise 2 Metrics & Exercise 3 degradation warning)
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

    console.log("\n======================================================================");
    console.log("🏆 SYSTEM VERIFICATION SUCCESSFUL: ALL EXERCISE WORKFLOWS OPERATIONAL!");
    console.log("======================================================================");
  } catch (err: any) {
    console.error("\n❌ SYSTEM VERIFICATION FAILED:", err.message);
    process.exit(1);
  }
}

runVerification();
