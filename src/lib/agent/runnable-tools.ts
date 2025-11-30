/**
 * Runnable Tools
 * 
 * Creates tool definitions with run functions for the Anthropic SDK's tool runner.
 * Uses betaTool helper for type-safe tool definitions.
 * 
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
 */

import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { evaluateMathExpression } from '@/lib/tools/handlers'
import {
  exaSearch,
  exaFindSimilar,
  exaAnswer,
  exaResearch,
  formatExaResultsForLLM,
  formatExaAnswerForLLM,
  formatExaResearchForLLM,
  isExaAvailable,
} from '@/lib/tools/exa'
import type { ExaSearchInput, ExaFindSimilarInput, ExaAnswerInput, ExaResearchInput } from '@/lib/tools/exa'
import type { ExaSearchCategory, ExaSearchType, ExaResearchModel } from '@/lib/types'
import type { SSEHandler } from './sse-handler'

/**
 * Creates runnable tools with access to SSE handlers for real-time updates
 */
export function createRunnableTools(sseHandler: SSEHandler) {
  return [
    // Calculator tool for mathematical expressions
    betaTool({
      name: 'calculator',
      description:
        'Evaluates mathematical expressions and returns the numerical result. Use this tool for ANY math calculation beyond simple mental arithmetic, including percentages, unit conversions, trigonometry, and complex formulas. The tool supports basic arithmetic operators (+, -, *, /), exponentiation (**), parentheses for grouping, and common math functions (sqrt, sin, cos, tan, asin, acos, atan, log, log10, log2, exp, pow, abs, floor, ceil, round, min, max, random) as well as constants (pi, e, PI, E). Do NOT use this tool for non-numeric operations, string manipulation, or when the user is asking about math concepts rather than computing a specific value.',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate. Use standard math notation with function calls for complex operations. Examples: "2 + 2", "sqrt(16)", "sin(pi/2)", "max(1, 2, 3)", "log(100)/log(10)", "(5 + 3) * 2 ** 3"',
          },
        },
        required: ['expression'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        const expression = input.expression
        try {
          if (!expression || typeof expression !== 'string' || expression.trim().length === 0) {
            const errorMsg = 'Error: Missing or empty "expression" parameter. Please provide a mathematical expression as a string.'
            await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = evaluateMathExpression(expression)
          const resultStr = `${result}`
          await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, resultStr)
          return resultStr
        } catch (error) {
          const errorMsg = `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // EXA semantic web search tool
    // Only include if EXA API key is configured
    // @see https://docs.exa.ai/reference/search
    // @see https://docs.exa.ai/reference/how-exa-search-works
    ...(isExaAvailable()
      ? [
          betaTool({
            name: 'exa_search',
            description:
              'Performs semantic/neural web search using the EXA API. Use this for deep research, finding specific content types (news, research papers, companies, GitHub repos), or when web_search returns insufficient results. EXA understands semantic meaning, not just keywords. COMBINE WITH OTHER TOOLS: Use exa_search for initial research → web_fetch for full content from promising URLs → web_search for current verification. Best for: research tasks, specific document types, date-filtered searches, academic/technical content.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    'The search query. EXA uses semantic search, so natural language queries work well. Be descriptive about what you\'re looking for.',
                },
                type: {
                  type: 'string',
                  enum: ['auto', 'neural', 'keyword', 'fast', 'deep'],
                  description:
                    'Search type: "auto" (default, best overall), "neural" (AI semantic), "keyword" (exact matching), "fast" (<400ms, for real-time apps), "deep" (comprehensive with query expansion, best for research).',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter results by content type. Use "research paper" for academic content, "news" for current events, "github" for code.',
                },
                numResults: {
                  type: 'number',
                  description:
                    'Number of results to return (1-10). Default is 5.',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published after this date (ISO 8601 format, e.g., "2024-01-01").',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published before this date (ISO 8601 format).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only search these domains (e.g., ["arxiv.org", "github.com"]).',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude results from these domains.',
                },
                livecrawl: {
                  type: 'boolean',
                  description:
                    'Enable livecrawling for fresh content. Use when you need very recent information not yet indexed.',
                },
                useHighlights: {
                  type: 'boolean',
                  description:
                    'Get key highlights/excerpts from content (default: true). Recommended for focused, relevant context.',
                },
                useSummary: {
                  type: 'boolean',
                  description:
                    'Get AI-generated summary of each result. Useful for quick understanding without reading full text.',
                },
                maxCharacters: {
                  type: 'number',
                  description:
                    'Maximum characters for text content (default: 1000). Increase for more context, decrease for efficiency.',
                },
              },
              required: ['query'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const searchInput: ExaSearchInput = {
                query: input.query,
                type: input.type as ExaSearchType | undefined,
                category: input.category as ExaSearchCategory | undefined,
                numResults: input.numResults,
                startPublishedDate: input.startPublishedDate,
                endPublishedDate: input.endPublishedDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
                livecrawl: input.livecrawl,
                useHighlights: input.useHighlights,
                useSummary: input.useSummary,
                maxCharacters: input.maxCharacters,
              }

              try {
                if (!searchInput.query || searchInput.query.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "query" parameter. Please provide a search query.'
                  await sseHandler.sendToolEvent('exa_search', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                const result = await exaSearch(searchInput)
                const formattedResult = formatExaResultsForLLM(result)

                // Send SSE event with structured EXA search data
                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_search',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaSearch: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA search error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_search', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // EXA Find Similar - discover related content from URLs
          // @see https://docs.exa.ai/reference/find-similar-links
          betaTool({
            name: 'exa_find_similar',
            description:
              'Find content similar to a given URL. Perfect for discovering related articles, research papers, competitors, or alternative sources. Returns semantically similar pages from across the web. Use after finding a great source to expand research.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description:
                    'The URL to find similar content for. Can be any webpage, article, or document.',
                },
                numResults: {
                  type: 'number',
                  description:
                    'Number of similar results to return (1-10). Default is 5.',
                },
                excludeSourceDomain: {
                  type: 'boolean',
                  description:
                    'Exclude results from the same domain as the input URL. Default is true.',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter similar results by content type.',
                },
                useHighlights: {
                  type: 'boolean',
                  description:
                    'Get key highlights from similar content. Default is true.',
                },
                useSummary: {
                  type: 'boolean',
                  description:
                    'Get AI-generated summaries of similar content.',
                },
              },
              required: ['url'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const similarInput: ExaFindSimilarInput = {
                url: input.url,
                numResults: input.numResults,
                excludeSourceDomain: input.excludeSourceDomain,
                category: input.category as ExaSearchCategory | undefined,
                useHighlights: input.useHighlights,
                useSummary: input.useSummary,
              }

              try {
                if (!similarInput.url || similarInput.url.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "url" parameter. Please provide a URL to find similar content.'
                  await sseHandler.sendToolEvent('exa_find_similar', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                const result = await exaFindSimilar(similarInput)
                const formattedResult = formatExaResultsForLLM(result)

                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_find_similar',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaSearch: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA find similar error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_find_similar', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // EXA Answer - direct question answering with sources
          // @see https://docs.exa.ai/reference/answer
          betaTool({
            name: 'exa_answer',
            description:
              'Get a direct, synthesized answer to a question with cited sources. EXA searches the web, analyzes content, and provides a comprehensive answer. Best for complex questions that need synthesis from multiple sources. Returns the answer plus source citations.',
            inputSchema: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description:
                    'The question to answer. Be specific and clear for best results.',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter sources by content type for more focused answers.',
                },
                includeText: {
                  type: 'boolean',
                  description:
                    'Include full text from source citations. Default is true.',
                },
              },
              required: ['question'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const answerInput: ExaAnswerInput = {
                question: input.question,
                category: input.category as ExaSearchCategory | undefined,
                includeText: input.includeText,
              }

              try {
                if (!answerInput.question || answerInput.question.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "question" parameter. Please provide a question to answer.'
                  await sseHandler.sendToolEvent('exa_answer', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                const result = await exaAnswer(answerInput)
                const formattedResult = formatExaAnswerForLLM(result)

                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_answer',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaAnswer: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA answer error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_answer', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // EXA Research - deep web research with structured output
          // @see https://docs.exa.ai/reference/exa-research
          betaTool({
            name: 'exa_research',
            description:
              'Perform deep, multi-step web research with optional structured output. This is an asynchronous research pipeline that: (1) Plans research steps from your instructions, (2) Searches the web with multiple queries, expanding and refining, (3) Synthesizes findings into a comprehensive report or structured JSON. Best for complex research requiring multiple sources and reasoning. Takes 20-90+ seconds. Use for: competitive analysis, market research, technical deep-dives, literature reviews, timeline construction.',
            inputSchema: {
              type: 'object',
              properties: {
                instructions: {
                  type: 'string',
                  description:
                    'Natural-language research instructions. Be explicit: describe (1) what information you want, (2) how to find it, (3) how to compose the final report. Max 4096 chars. Example: "Compare flagship GPUs from NVIDIA, AMD, Intel. Find MSRP, TDP, and launch dates. Return as a comparison table with citations."',
                },
                outputSchema: {
                  type: 'object',
                  description:
                    'Optional JSON Schema for structured output. Keep small (1-5 root fields). Use enums for better accuracy. Max 8 root fields, 5 levels deep. If not provided, returns detailed markdown report.',
                  additionalProperties: true,
                },
                model: {
                  type: 'string',
                  enum: ['exa-research', 'exa-research-pro'],
                  description:
                    'Research model: "exa-research" (default) adapts to task complexity, "exa-research-pro" uses maximum reasoning for complex multi-step research. Pro takes longer but higher quality.',
                },
                timeoutMs: {
                  type: 'number',
                  description:
                    'Maximum wait time in milliseconds. Default: 120000 (2 min). Research typically takes 20-90 seconds.',
                },
              },
              required: ['instructions'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const researchInput: ExaResearchInput = {
                instructions: input.instructions,
                outputSchema: input.outputSchema as Record<string, unknown> | undefined,
                model: input.model as ExaResearchModel | undefined,
                timeoutMs: input.timeoutMs,
              }

              try {
                if (!researchInput.instructions || researchInput.instructions.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "instructions" parameter. Please provide research instructions.'
                  await sseHandler.sendToolEvent('exa_research', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                // Send start event since research can take a while
                await sseHandler.sendToolEvent('exa_research', 'start', input as Record<string, unknown>)

                const result = await exaResearch(researchInput)
                const formattedResult = formatExaResearchForLLM(result)

                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_research',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaResearch: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA research error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_research', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),
        ]
      : []),
  ]
}

