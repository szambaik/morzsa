import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';

export const categories = ['confirmed-bug','reproducible-usability','visual-inconsistency','accessibility','product-opportunity','hypothesis','environment-limitation'];
export const severities = ['Critical','High','Medium','Low'];
export const priorities = ['P0','P1','P2','P3'];
export const confidence = ['High','Medium','Low'];
export const statuses = ['reproduced','verified','observed-once','needs-validation','not-testable','rejected'];
const str = {type:'string',minLength:1};
const strings = {type:'array',items:str};
export const evidenceSchema = {type:'object',additionalProperties:false,properties:{path:str,description:str,kind:{enum:['screenshot','trace','dom','network','console','test','other']}},required:['path','description','kind']};
export const findingSchema = {
  $id:'https://morzsa.local/audit/finding.schema.json',type:'object',additionalProperties:false,
  properties:{id:{...str,pattern:'^[A-Za-z0-9][A-Za-z0-9_.-]*$'},title:str,category:{enum:categories},severity:{enum:severities},priority:{enum:priorities},confidence:{enum:confidence},affectedScreen:str,routeOrComponent:str,reproductionSteps:strings,expectedBehavior:str,actualBehavior:str,userImpact:str,evidence:{type:'array',items:evidenceSchema},screenshotRefs:strings,sourceFiles:strings,recommendedSolution:str,acceptanceCriteria:strings,validationStatus:{enum:statuses},duplicateKey:str,regressionTests:strings,notes:strings},
  required:['id','title','category','severity','priority','confidence','affectedScreen','routeOrComponent','reproductionSteps','expectedBehavior','actualBehavior','userImpact','evidence','screenshotRefs','sourceFiles','recommendedSolution','acceptanceCriteria','validationStatus']
};
export const reviewSchema = {
  $id:'https://morzsa.local/audit/review.schema.json',type:'object',additionalProperties:false,
  properties:{agent:{enum:['ux','visual','qa','accessibility','product']},reviewStatus:{enum:['completed','unavailable']},method:{enum:['codex-subagent','codex-cli','manual','unavailable']},scope:str,evidenceReviewed:strings,strengths:strings,limitations:strings,findings:{type:'array',items:findingSchema}},
  required:['agent','reviewStatus','method','scope','evidenceReviewed','strengths','limitations','findings']
};
const ajv = new Ajv({allErrors:true,strict:false});
const validateFinding = ajv.compile(findingSchema);
const validateReview = ajv.compile(reviewSchema);

export function evidencePath(runDir, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) return null;
  const root = path.resolve(runDir), resolved = path.resolve(root,relativePath);
  if (resolved !== root && !resolved.startsWith(root+path.sep)) return null;
  try {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(fs.realpathSync(root)+path.sep) || !fs.statSync(real).isFile()) return null;
    return real;
  } catch { return null; }
}
export function validateFindingRecord(finding,runDir) {
  const errors = [];
  if (!validateFinding(finding)) errors.push(...validateFinding.errors.map(e=>e.instancePath+' '+e.message));
  if (errors.length) return errors;
  for (const e of finding.evidence) if (!evidencePath(runDir,e.path)) errors.push('Missing or unsafe evidence: '+e.path);
  for (const p of finding.screenshotRefs) if (!evidencePath(runDir,p)) errors.push('Missing or unsafe screenshot: '+p);
  if (!['environment-limitation','hypothesis'].includes(finding.category) && finding.evidence.length === 0) errors.push('Observed finding requires supporting evidence');
  if (finding.category === 'hypothesis' && (finding.confidence === 'High' || ['verified','reproduced'].includes(finding.validationStatus))) errors.push('A hypothesis cannot be high-confidence or confirmed');
  if (finding.category === 'confirmed-bug' && !['reproduced','verified'].includes(finding.validationStatus)) errors.push('Confirmed bug requires reproduced or verified validation status');
  if (finding.confidence === 'High' && !['reproduced','verified'].includes(finding.validationStatus)) errors.push('High confidence requires reproduced or verified evidence');
  if (finding.priority === 'P0' && finding.severity !== 'Critical') errors.push('P0 requires Critical severity');
  if (finding.severity === 'Critical' && finding.priority !== 'P0') errors.push('Critical severity requires P0 priority');
  return errors;
}
export function validateReviewRecord(review,runDir) {
  const errors=[];
  if (!validateReview(review)) return validateReview.errors.map(e=>e.instancePath+' '+e.message);
  if (review.reviewStatus === 'unavailable' && review.findings.length) errors.push('Unavailable review cannot contain findings');
  if (review.reviewStatus === 'completed' && review.method === 'unavailable') errors.push('Completed review must identify its actual method');
  for (const p of review.evidenceReviewed) if (!evidencePath(runDir,p)) errors.push('Missing reviewed evidence: '+p);
  for (const f of review.findings) errors.push(...validateFindingRecord(f,runDir).map(e=>f.id+': '+e));
  return errors;
}
