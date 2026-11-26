/**
 * Model support: recommended interactions, providers and strategies for Core model calls.
 *
 * Applications compose these implementations and hand them to a Core `ModelRunner`. This module
 * owns wire adaptation and local admission budgets only; credentials, HTTP hosting and business
 * policy stay with the application, and Core does not import this code.
 *
 * Main exports: interaction creators, `CompatibleModelProvider`, stage interaction projection,
 * capability/interaction catalogs, child-task execution, reply preview helpers, provider
 * observation scopes and `createModelStrategy` with its budget presets.
 */
export * from './transports.js';
export * from './compatible-provider.js';
export * from './completion/index.js';
export * from './interactions/index.js';
export * from './chat-completions.js';
export type * from '../../structs/support/model/completion.js';
export type * from '../../structs/support/model/messages.js';
export type * from '../../structs/support/model/interactions.js';
export type * from '../../structs/support/model/provider.js';
export { defineModelTools } from './capabilities.js';
export { createStageModelInteraction } from './stage-transport.js';
export { createProviderObservationScope } from './observer.js';
export { createReplyPreviewRules } from './preview-rules.js';
export type { PreviewTool, ReplyPreviewTool, ReplyPreviewStage } from './preview-rules.js';
export { runChildren } from './children.js';
export type { ModelChildTask, ModelChildrenOptions } from './children.js';
export { createModelStrategy, modelBudgetStrategies } from './strategies.js';
export type { ModelBudgetStrategy, ModelStrategyOptions } from './strategies.js';
export { assessModelBudget } from './budget-assessment.js';
export type {
  BudgetAssessmentInput,
  BudgetAssessment,
  RemainingModelWork,
} from './budget-assessment.js';

export * from './provider-factory.js';
export * from './resources.js';
export * from './continuation.js';
export * from './lifecycle/http.js';
export * from './lifecycle/realtime.js';
export * from './lifecycle/batch.js';
export * from './lifecycle/session.js';

export * from './lifecycle/background.js';

/** @deprecated Use `createStageModelInteraction`. */
export { createStageModelInteraction as createStageModelTransport } from './stage-transport.js';
