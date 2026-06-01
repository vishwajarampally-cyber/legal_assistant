import { traceable } from 'langsmith/traceable';
import { wrapOpenAI } from 'langsmith/wrappers/openai';

export class LangSmithService {
  static configureEnvironment() {
    if (!process.env.LANGSMITH_TRACING && process.env.LANGCHAIN_TRACING_V2) {
      process.env.LANGSMITH_TRACING = process.env.LANGCHAIN_TRACING_V2;
    }

    if (!process.env.LANGSMITH_API_KEY && process.env.LANGCHAIN_API_KEY) {
      process.env.LANGSMITH_API_KEY = process.env.LANGCHAIN_API_KEY;
    }

    if (!process.env.LANGSMITH_PROJECT && process.env.LANGCHAIN_PROJECT) {
      process.env.LANGSMITH_PROJECT = process.env.LANGCHAIN_PROJECT;
    }

    if (!process.env.LANGSMITH_ENDPOINT && process.env.LANGCHAIN_ENDPOINT) {
      process.env.LANGSMITH_ENDPOINT = process.env.LANGCHAIN_ENDPOINT;
    }

    // Vercel/serverless functions can finish before background callbacks flush.
    if (!process.env.LANGCHAIN_CALLBACKS_BACKGROUND) {
      process.env.LANGCHAIN_CALLBACKS_BACKGROUND = process.env.VERCEL ? 'false' : 'true';
    }
  }

  static isEnabled() {
    this.configureEnvironment();
    return process.env.LANGSMITH_TRACING === 'true' && Boolean(process.env.LANGSMITH_API_KEY);
  }

  static traceFunction(fn, config) {
    this.configureEnvironment();
    return traceable(fn, {
      ...config,
      tracingEnabled: this.isEnabled(),
      project_name: process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT,
    });
  }

  static wrapOpenAIClient(client, config = {}) {
    this.configureEnvironment();
    if (!this.isEnabled()) {
      return client;
    }

    return wrapOpenAI(client, {
      ...config,
      project_name: process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT,
    });
  }

  static getStatus() {
    this.configureEnvironment();
    return {
      enabled: this.isEnabled(),
      project: process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT || 'default',
      hasApiKey: Boolean(process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY),
      callbacksBackground: process.env.LANGCHAIN_CALLBACKS_BACKGROUND,
    };
  }
}
