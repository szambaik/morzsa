# Engine contract

Entry: node design-audit/engine.mjs --profile full [--agents codex]

Browser module: design-audit/browser.mjs exports async runBrowser({runDir,profile,repoRoot}). Return {checks,journeys,evidence,limitations,candidates?}. Checks: {id,title,status: passed|failed|skipped,details,evidence:[]}; journeys {id,title,status,steps:[],limitations:[]}; evidence {path,description,kind}. Paths relative to runDir. Extra fields retained. Engine writes evidence/results.json and baseline.json.

Review inputs: runDir/reviews/{ux,visual,qa,accessibility,product}.json.
Envelope: {agent,reviewStatus:completed|unavailable,method:codex-subagent|codex-cli|manual|unavailable,scope:string,evidenceReviewed:string[],strengths:string[],limitations:string[],findings:[]}.

Finding required fields: id,title,category,severity,priority,confidence,affectedScreen,routeOrComponent,reproductionSteps:string[],expectedBehavior,actualBehavior,userImpact,evidence:[{path,description,kind}],screenshotRefs:string[],sourceFiles:string[],recommendedSolution,acceptanceCriteria:string[],validationStatus.

category: confirmed-bug|reproducible-usability|visual-inconsistency|accessibility|product-opportunity|hypothesis|environment-limitation.
severity: Critical|High|Medium|Low; priority P0|P1|P2|P3; confidence High|Medium|Low.
validationStatus: reproduced|verified|observed-once|needs-validation|not-testable|rejected.
Evidence kind: screenshot|trace|dom|network|console|test|other.
Optional finding fields: duplicateKey, regressionTests:string[], notes:string[].

Cross-validation: runDir/validation.json array of {findingId,status:reproduced|verified|rejected|needs-validation,evidence:[{path,description,kind}],notes:string}. P0/P1 confirmation requires this separate orchestrator review.

Finalize real reviews: node design-audit/engine.mjs --finalize /absolute/runDir
Compare runs: node design-audit/engine.mjs --compare /old/runDir /new/runDir

Timestamped runs and report snapshots preserve all earlier evidence and reports.
