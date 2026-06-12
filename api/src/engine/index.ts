export { toMonthly, toAnnual, monthlyToAnnual, annualToMonthly } from './normalize.js';
export {
  computeFederalTax,
  getStandardDeduction,
  computeStateTax,
  getStateRate,
  computeFICA,
  estimateTaxes,
} from './tax.js';
export { resolveItemMonthly, resolveItemAnnual } from './resolve-amount.js';
export { computeMemberWaterfall } from './waterfall.js';
export { computeHouseholdWaterfall } from './household.js';
export {
  fiNumber,
  securityFI,
  coastFI,
  boilingPoint,
  progressToFI,
  yearsToFI,
  computeFIMetrics,
} from './metrics.js';
export { computeProjection } from './projections.js';
export { computeSavingsRates } from './savings.js';
export {
  resolveAssumptionValues,
  buildScenarioAssumptions,
  buildTaxParams,
} from './assumptions.js';
export { classifySymbol, computeComposition } from './composition.js';
export type * from './types.js';
export type { FIMetricsInput, FIMetrics } from './metrics.js';
export type {
  ProjectionInput,
  ProjectionResult,
  ProjectionYear,
  AccountContribution,
} from './projections.js';
export type { SavingsRateInput, SavingsRates } from './savings.js';
export type {
  CompositionInput,
  CompositionPositionInput,
  CompositionCashAccountInput,
  CompositionAccountInput,
  SymbolClassification,
} from './composition.js';
