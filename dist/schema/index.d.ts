import { z } from "zod";
import { type ParsedYaml } from "../types/json.js";
declare const CapabilityDefinitionSchema: z.ZodObject<{
    type: z.ZodEnum<["tool", "skill", "hybrid"]>;
    description: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
    persistence: z.ZodOptional<z.ZodString>;
    rate_limit: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    guards: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Capability ids this capability may call at runtime via runContext.invokeCapability. Must exist in config.capabilities. */
    depends_on: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Metadata for registry search (optional; may be YAML or skill-generated). */
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    category: z.ZodOptional<z.ZodString>;
    intent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "tool" | "skill" | "hybrid";
    tags?: string[] | undefined;
    category?: string | undefined;
    intent?: string | undefined;
    source?: string | undefined;
    description?: string | undefined;
    config?: Record<string, import("../types/json.js").JsonValue> | undefined;
    persistence?: string | undefined;
    rate_limit?: string | undefined;
    prompt?: string | undefined;
    guards?: string[] | undefined;
    depends_on?: string[] | undefined;
}, {
    type: "tool" | "skill" | "hybrid";
    tags?: string[] | undefined;
    category?: string | undefined;
    intent?: string | undefined;
    source?: string | undefined;
    description?: string | undefined;
    config?: Record<string, import("../types/json.js").JsonValue> | undefined;
    persistence?: string | undefined;
    rate_limit?: string | undefined;
    prompt?: string | undefined;
    guards?: string[] | undefined;
    depends_on?: string[] | undefined;
}>;
declare const AgentSchema: z.ZodObject<{
    provider: z.ZodString;
    model: z.ZodString;
    role: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    capabilities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>, "many">;
    fallback: z.ZodOptional<z.ZodString>;
    max_concurrent_tasks: z.ZodOptional<z.ZodNumber>;
    /** Metadata for registry search (optional). */
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    role_category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    capabilities: {
        name: string;
    }[];
    provider: string;
    model: string;
    role: string;
    tags?: string[] | undefined;
    role_category?: string | undefined;
    description?: string | undefined;
    fallback?: string | undefined;
    max_concurrent_tasks?: number | undefined;
}, {
    capabilities: {
        name: string;
    }[];
    provider: string;
    model: string;
    role: string;
    tags?: string[] | undefined;
    role_category?: string | undefined;
    description?: string | undefined;
    fallback?: string | undefined;
    max_concurrent_tasks?: number | undefined;
}>;
declare const SequentialStepSchema: z.ZodObject<{
    agent: z.ZodString;
    action: z.ZodString;
    on_failure: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
    condition: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agent: string;
    action: string;
    params?: Record<string, import("../types/json.js").JsonValue> | undefined;
    on_failure?: string | undefined;
    condition?: string | undefined;
}, {
    agent: string;
    action: string;
    params?: Record<string, import("../types/json.js").JsonValue> | undefined;
    on_failure?: string | undefined;
    condition?: string | undefined;
}>;
declare const ParallelStepSchema: z.ZodObject<{
    parallel: z.ZodArray<z.ZodObject<{
        agent: z.ZodString;
        action: z.ZodString;
        on_failure: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
        condition: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    }, {
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    parallel: {
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    }[];
}, {
    parallel: {
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    }[];
}>;
declare const WorkflowSchema: z.ZodObject<{
    trigger: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    persistence: z.ZodOptional<z.ZodString>;
    steps: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        agent: z.ZodString;
        action: z.ZodString;
        on_failure: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
        condition: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    }, {
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    }>, z.ZodObject<{
        parallel: z.ZodArray<z.ZodObject<{
            agent: z.ZodString;
            action: z.ZodString;
            on_failure: z.ZodOptional<z.ZodString>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
            condition: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }, {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        parallel: {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }[];
    }, {
        parallel: {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }[];
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    trigger: string;
    steps: ({
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    } | {
        parallel: {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }[];
    })[];
    description?: string | undefined;
    persistence?: string | undefined;
}, {
    trigger: string;
    steps: ({
        agent: string;
        action: string;
        params?: Record<string, import("../types/json.js").JsonValue> | undefined;
        on_failure?: string | undefined;
        condition?: string | undefined;
    } | {
        parallel: {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }[];
    })[];
    description?: string | undefined;
    persistence?: string | undefined;
}>;
declare const SchedulerSchema: z.ZodOptional<z.ZodObject<{
    heartbeat_interval_seconds: z.ZodOptional<z.ZodNumber>;
    max_concurrent_workflows: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    heartbeat_interval_seconds?: number | undefined;
    max_concurrent_workflows?: number | undefined;
}, {
    heartbeat_interval_seconds?: number | undefined;
    max_concurrent_workflows?: number | undefined;
}>>;
declare const BackboneSchema: z.ZodObject<{
    type: z.ZodEnum<["redis", "rabbitmq", "kafka"]>;
    config: z.ZodObject<{
        url: z.ZodString;
        queues: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodEnum<["pubsub", "fifo"]>;
        }, "strip", z.ZodTypeAny, {
            type: "pubsub" | "fifo";
            name: string;
        }, {
            type: "pubsub" | "fifo";
            name: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        url: string;
        queues: {
            type: "pubsub" | "fifo";
            name: string;
        }[];
    }, {
        url: string;
        queues: {
            type: "pubsub" | "fifo";
            name: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    type: "redis" | "rabbitmq" | "kafka";
    config: {
        url: string;
        queues: {
            type: "pubsub" | "fifo";
            name: string;
        }[];
    };
}, {
    type: "redis" | "rabbitmq" | "kafka";
    config: {
        url: string;
        queues: {
            type: "pubsub" | "fifo";
            name: string;
        }[];
    };
}>;
declare const OrgSchema: z.ZodObject<{
    version: z.ZodString;
    org: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        goals: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>]>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        goals: (string | Record<string, import("../types/json.js").JsonValue>)[];
        description?: string | undefined;
    }, {
        name: string;
        goals: (string | Record<string, import("../types/json.js").JsonValue>)[];
        description?: string | undefined;
    }>;
    agents: z.ZodRecord<z.ZodString, z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        capabilities: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
        }, {
            name: string;
        }>, "many">;
        fallback: z.ZodOptional<z.ZodString>;
        max_concurrent_tasks: z.ZodOptional<z.ZodNumber>;
        /** Metadata for registry search (optional). */
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        role_category: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        capabilities: {
            name: string;
        }[];
        provider: string;
        model: string;
        role: string;
        tags?: string[] | undefined;
        role_category?: string | undefined;
        description?: string | undefined;
        fallback?: string | undefined;
        max_concurrent_tasks?: number | undefined;
    }, {
        capabilities: {
            name: string;
        }[];
        provider: string;
        model: string;
        role: string;
        tags?: string[] | undefined;
        role_category?: string | undefined;
        description?: string | undefined;
        fallback?: string | undefined;
        max_concurrent_tasks?: number | undefined;
    }>>;
    capabilities: z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<["tool", "skill", "hybrid"]>;
        description: z.ZodOptional<z.ZodString>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
        persistence: z.ZodOptional<z.ZodString>;
        rate_limit: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodString>;
        prompt: z.ZodOptional<z.ZodString>;
        guards: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Capability ids this capability may call at runtime via runContext.invokeCapability. Must exist in config.capabilities. */
        depends_on: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Metadata for registry search (optional; may be YAML or skill-generated). */
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        category: z.ZodOptional<z.ZodString>;
        intent: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "tool" | "skill" | "hybrid";
        tags?: string[] | undefined;
        category?: string | undefined;
        intent?: string | undefined;
        source?: string | undefined;
        description?: string | undefined;
        config?: Record<string, import("../types/json.js").JsonValue> | undefined;
        persistence?: string | undefined;
        rate_limit?: string | undefined;
        prompt?: string | undefined;
        guards?: string[] | undefined;
        depends_on?: string[] | undefined;
    }, {
        type: "tool" | "skill" | "hybrid";
        tags?: string[] | undefined;
        category?: string | undefined;
        intent?: string | undefined;
        source?: string | undefined;
        description?: string | undefined;
        config?: Record<string, import("../types/json.js").JsonValue> | undefined;
        persistence?: string | undefined;
        rate_limit?: string | undefined;
        prompt?: string | undefined;
        guards?: string[] | undefined;
        depends_on?: string[] | undefined;
    }>>;
    workflows: z.ZodRecord<z.ZodString, z.ZodObject<{
        trigger: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        persistence: z.ZodOptional<z.ZodString>;
        steps: z.ZodArray<z.ZodUnion<[z.ZodObject<{
            agent: z.ZodString;
            action: z.ZodString;
            on_failure: z.ZodOptional<z.ZodString>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
            condition: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }, {
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        }>, z.ZodObject<{
            parallel: z.ZodArray<z.ZodObject<{
                agent: z.ZodString;
                action: z.ZodString;
                on_failure: z.ZodOptional<z.ZodString>;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>>;
                condition: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }, {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            parallel: {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }[];
        }, {
            parallel: {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }[];
        }>]>, "many">;
    }, "strip", z.ZodTypeAny, {
        trigger: string;
        steps: ({
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        } | {
            parallel: {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }[];
        })[];
        description?: string | undefined;
        persistence?: string | undefined;
    }, {
        trigger: string;
        steps: ({
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        } | {
            parallel: {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }[];
        })[];
        description?: string | undefined;
        persistence?: string | undefined;
    }>>;
    backbone: z.ZodObject<{
        type: z.ZodEnum<["redis", "rabbitmq", "kafka"]>;
        config: z.ZodObject<{
            url: z.ZodString;
            queues: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodEnum<["pubsub", "fifo"]>;
            }, "strip", z.ZodTypeAny, {
                type: "pubsub" | "fifo";
                name: string;
            }, {
                type: "pubsub" | "fifo";
                name: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            url: string;
            queues: {
                type: "pubsub" | "fifo";
                name: string;
            }[];
        }, {
            url: string;
            queues: {
                type: "pubsub" | "fifo";
                name: string;
            }[];
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "redis" | "rabbitmq" | "kafka";
        config: {
            url: string;
            queues: {
                type: "pubsub" | "fifo";
                name: string;
            }[];
        };
    }, {
        type: "redis" | "rabbitmq" | "kafka";
        config: {
            url: string;
            queues: {
                type: "pubsub" | "fifo";
                name: string;
            }[];
        };
    }>;
    scheduler: z.ZodOptional<z.ZodObject<{
        heartbeat_interval_seconds: z.ZodOptional<z.ZodNumber>;
        max_concurrent_workflows: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        heartbeat_interval_seconds?: number | undefined;
        max_concurrent_workflows?: number | undefined;
    }, {
        heartbeat_interval_seconds?: number | undefined;
        max_concurrent_workflows?: number | undefined;
    }>>;
    middleware: z.ZodOptional<z.ZodObject<{
        agent: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        capability: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        agent?: string[] | undefined;
        capability?: string[] | undefined;
    }, {
        agent?: string[] | undefined;
        capability?: string[] | undefined;
    }>>;
    fault_tolerance: z.ZodOptional<z.ZodObject<{
        health_checks_interval: z.ZodOptional<z.ZodString>;
        rogue_detection: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodRecord<z.ZodString, z.ZodType<import("../types/json.js").JsonValue, z.ZodTypeDef, import("../types/json.js").JsonValue>>]>, "many">>;
        retries: z.ZodOptional<z.ZodObject<{
            default: z.ZodNumber;
            backoff: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            default: number;
            backoff: string;
        }, {
            default: number;
            backoff: string;
        }>>;
        circuit_breaker: z.ZodOptional<z.ZodObject<{
            threshold: z.ZodString;
            reset_after: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            threshold: string;
            reset_after: string;
        }, {
            threshold: string;
            reset_after: string;
        }>>;
        dead_letter_queue: z.ZodOptional<z.ZodBoolean>;
        alerts: z.ZodOptional<z.ZodObject<{
            webhook: z.ZodOptional<z.ZodString>;
            channels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            webhook?: string | undefined;
            channels?: string[] | undefined;
        }, {
            webhook?: string | undefined;
            channels?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        health_checks_interval?: string | undefined;
        rogue_detection?: (string | Record<string, import("../types/json.js").JsonValue>)[] | undefined;
        retries?: {
            default: number;
            backoff: string;
        } | undefined;
        circuit_breaker?: {
            threshold: string;
            reset_after: string;
        } | undefined;
        dead_letter_queue?: boolean | undefined;
        alerts?: {
            webhook?: string | undefined;
            channels?: string[] | undefined;
        } | undefined;
    }, {
        health_checks_interval?: string | undefined;
        rogue_detection?: (string | Record<string, import("../types/json.js").JsonValue>)[] | undefined;
        retries?: {
            default: number;
            backoff: string;
        } | undefined;
        circuit_breaker?: {
            threshold: string;
            reset_after: string;
        } | undefined;
        dead_letter_queue?: boolean | undefined;
        alerts?: {
            webhook?: string | undefined;
            channels?: string[] | undefined;
        } | undefined;
    }>>;
    registry: z.ZodOptional<z.ZodObject<{
        mongo_uri: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        mongo_uri?: string | undefined;
    }, {
        mongo_uri?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    org: {
        name: string;
        goals: (string | Record<string, import("../types/json.js").JsonValue>)[];
        description?: string | undefined;
    };
    capabilities: Record<string, {
        type: "tool" | "skill" | "hybrid";
        tags?: string[] | undefined;
        category?: string | undefined;
        intent?: string | undefined;
        source?: string | undefined;
        description?: string | undefined;
        config?: Record<string, import("../types/json.js").JsonValue> | undefined;
        persistence?: string | undefined;
        rate_limit?: string | undefined;
        prompt?: string | undefined;
        guards?: string[] | undefined;
        depends_on?: string[] | undefined;
    }>;
    agents: Record<string, {
        capabilities: {
            name: string;
        }[];
        provider: string;
        model: string;
        role: string;
        tags?: string[] | undefined;
        role_category?: string | undefined;
        description?: string | undefined;
        fallback?: string | undefined;
        max_concurrent_tasks?: number | undefined;
    }>;
    version: string;
    workflows: Record<string, {
        trigger: string;
        steps: ({
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        } | {
            parallel: {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }[];
        })[];
        description?: string | undefined;
        persistence?: string | undefined;
    }>;
    backbone: {
        type: "redis" | "rabbitmq" | "kafka";
        config: {
            url: string;
            queues: {
                type: "pubsub" | "fifo";
                name: string;
            }[];
        };
    };
    scheduler?: {
        heartbeat_interval_seconds?: number | undefined;
        max_concurrent_workflows?: number | undefined;
    } | undefined;
    middleware?: {
        agent?: string[] | undefined;
        capability?: string[] | undefined;
    } | undefined;
    fault_tolerance?: {
        health_checks_interval?: string | undefined;
        rogue_detection?: (string | Record<string, import("../types/json.js").JsonValue>)[] | undefined;
        retries?: {
            default: number;
            backoff: string;
        } | undefined;
        circuit_breaker?: {
            threshold: string;
            reset_after: string;
        } | undefined;
        dead_letter_queue?: boolean | undefined;
        alerts?: {
            webhook?: string | undefined;
            channels?: string[] | undefined;
        } | undefined;
    } | undefined;
    registry?: {
        mongo_uri?: string | undefined;
    } | undefined;
}, {
    org: {
        name: string;
        goals: (string | Record<string, import("../types/json.js").JsonValue>)[];
        description?: string | undefined;
    };
    capabilities: Record<string, {
        type: "tool" | "skill" | "hybrid";
        tags?: string[] | undefined;
        category?: string | undefined;
        intent?: string | undefined;
        source?: string | undefined;
        description?: string | undefined;
        config?: Record<string, import("../types/json.js").JsonValue> | undefined;
        persistence?: string | undefined;
        rate_limit?: string | undefined;
        prompt?: string | undefined;
        guards?: string[] | undefined;
        depends_on?: string[] | undefined;
    }>;
    agents: Record<string, {
        capabilities: {
            name: string;
        }[];
        provider: string;
        model: string;
        role: string;
        tags?: string[] | undefined;
        role_category?: string | undefined;
        description?: string | undefined;
        fallback?: string | undefined;
        max_concurrent_tasks?: number | undefined;
    }>;
    version: string;
    workflows: Record<string, {
        trigger: string;
        steps: ({
            agent: string;
            action: string;
            params?: Record<string, import("../types/json.js").JsonValue> | undefined;
            on_failure?: string | undefined;
            condition?: string | undefined;
        } | {
            parallel: {
                agent: string;
                action: string;
                params?: Record<string, import("../types/json.js").JsonValue> | undefined;
                on_failure?: string | undefined;
                condition?: string | undefined;
            }[];
        })[];
        description?: string | undefined;
        persistence?: string | undefined;
    }>;
    backbone: {
        type: "redis" | "rabbitmq" | "kafka";
        config: {
            url: string;
            queues: {
                type: "pubsub" | "fifo";
                name: string;
            }[];
        };
    };
    scheduler?: {
        heartbeat_interval_seconds?: number | undefined;
        max_concurrent_workflows?: number | undefined;
    } | undefined;
    middleware?: {
        agent?: string[] | undefined;
        capability?: string[] | undefined;
    } | undefined;
    fault_tolerance?: {
        health_checks_interval?: string | undefined;
        rogue_detection?: (string | Record<string, import("../types/json.js").JsonValue>)[] | undefined;
        retries?: {
            default: number;
            backoff: string;
        } | undefined;
        circuit_breaker?: {
            threshold: string;
            reset_after: string;
        } | undefined;
        dead_letter_queue?: boolean | undefined;
        alerts?: {
            webhook?: string | undefined;
            channels?: string[] | undefined;
        } | undefined;
    } | undefined;
    registry?: {
        mongo_uri?: string | undefined;
    } | undefined;
}>;
export type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>;
export type AgentConfig = z.infer<typeof AgentSchema>;
export type SequentialStep = z.infer<typeof SequentialStepSchema>;
export type ParallelStep = z.infer<typeof ParallelStepSchema>;
export type WorkflowConfig = z.infer<typeof WorkflowSchema>;
export type SchedulerConfig = z.infer<typeof SchedulerSchema>;
export type BackboneConfig = z.infer<typeof BackboneSchema>;
export type OrgConfig = z.infer<typeof OrgSchema>;
/** Default scheduler values when scheduler section is omitted. */
export declare const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 60;
export declare const DEFAULT_MAX_CONCURRENT_WORKFLOWS = 1;
export declare function validate(raw: ParsedYaml): OrgConfig;
export { OrgSchema };
//# sourceMappingURL=index.d.ts.map