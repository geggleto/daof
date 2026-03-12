import type { CapabilityDefinition } from "../../schema/index.js";
import type { CapabilityInstance } from "../../types/json.js";
import { createLoggerInstance } from "./logger.js";
import { createEventEmitterInstance } from "./event_emitter.js";
import { createWebhookNotifierInstance } from "./webhook_notifier.js";
import { createKeyValueStoreInstance } from "./key_value_store.js";
import { createImageGeneratorInstance } from "./image_generator.js";
import { createTextGeneratorInstance } from "./text_generator.js";
import { createSentimentAnalyzerInstance } from "./sentiment_analyzer.js";
import { createXPosterInstance } from "./x_poster.js";
import { createMetricsFetcherInstance } from "./metrics_fetcher.js";
import { createFileUploaderInstance } from "./file_uploader.js";
import { createTweetPostRecordInstance } from "./tweet_post_record.js";
import { createTweetMetricsProcessorInstance } from "./tweet_metrics_processor.js";
import { createProducePrdInstance } from "./produce_prd.js";
import { createGenerateYamlInstance } from "./generate_yaml.js";
import { createMergeAndWriteInstance } from "./merge_and_write.js";
import { createVerifyBuildInstance } from "./verify_build.js";
import { createVerifySimilarityInstance } from "./verify_similarity.js";
import { createBuildReplyInstance } from "./build_reply.js";
import { createFetchAgentPerformanceInstance } from "./fetch_agent_performance.js";
import { createApplyCapabilityUpgradeInstance } from "./apply_capability_upgrade.js";

export type BundledCapabilityFactory = (
  capabilityId: string,
  def: CapabilityDefinition
) => CapabilityInstance;

const registry: Record<string, BundledCapabilityFactory> = {
  logger: createLoggerInstance,
  event_emitter: createEventEmitterInstance,
  webhook_notifier: createWebhookNotifierInstance,
  key_value_store: createKeyValueStoreInstance,
  image_generator: createImageGeneratorInstance,
  text_generator: createTextGeneratorInstance,
  sentiment_analyzer: createSentimentAnalyzerInstance,
  x_poster: createXPosterInstance,
  metrics_fetcher: createMetricsFetcherInstance,
  file_uploader: createFileUploaderInstance,
  tweet_post_record: createTweetPostRecordInstance,
  tweet_metrics_processor: createTweetMetricsProcessorInstance,
  produce_prd: createProducePrdInstance,
  generate_yaml: createGenerateYamlInstance,
  merge_and_write: createMergeAndWriteInstance,
  verify_build: createVerifyBuildInstance,
  verify_similarity: createVerifySimilarityInstance,
  build_reply: createBuildReplyInstance,
  fetch_agent_performance: createFetchAgentPerformanceInstance,
  apply_capability_upgrade: createApplyCapabilityUpgradeInstance,
};

/**
 * Return a bundled CapabilityInstance for the given id if one exists; otherwise undefined.
 */
export function getBundledCapability(
  capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance | undefined {
  const factory = registry[capabilityId];
  if (!factory) return undefined;
  return factory(capabilityId, def);
}

/**
 * Set of capability ids that have bundled implementations.
 */
export const BUNDLED_IDS = new Set<string>(Object.keys(registry));
