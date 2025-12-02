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
  formatExaResultsForLLM,
  formatExaAnswerForLLM,
  isExaAvailable,
} from '@/lib/tools/exa'
import type { ExaSearchInput, ExaFindSimilarInput, ExaAnswerInput } from '@/lib/tools/exa'
import type { ExaSearchCategory, ExaSearchType } from '@/lib/types'
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

    // EXA semantic web search tool - POWERFUL research tool
    // Only include if EXA API key is configured
    // @see https://docs.exa.ai/reference/search
    // @see https://docs.exa.ai/reference/how-exa-search-works
    ...(isExaAvailable()
      ? [
          betaTool({
            name: 'exa_search',
            description:
              'POWERFUL semantic/neural web search using EXA API. Returns up to 100 results with fresh content via livecrawling. Use for: deep research, finding specific content types (news, research papers, companies, GitHub repos, tweets), date-filtered searches, academic/technical content. EXA understands semantic meaning, not keywords. \n\nGUIDELINES:\n- Use "type: neural" (default) for broad concepts, "how to", and research topics.\n- Use "type: keyword" for specific entity names, error codes, or exact phrases.\n- Use "livecrawl: always" for BREAKING news or real-time data.\n- COMBINE: exa_search for research → web_fetch for full content from best URLs.',
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
                    'Search type: "auto" (default, best overall), "neural" (AI semantic), "keyword" (exact matching), "fast" (<425ms p50, for real-time), "deep" (comprehensive with query expansion, BEST for research).',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'tweet',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter results by content type. Use "research paper" for academic, "news" for current events, "github" for code, "tweet" for social media.',
                },
                numResults: {
                  type: 'number',
                  description:
                    'Number of results to return (1-100). Default is 10. Use higher values (20-50) for comprehensive research.',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published after this date (ISO 8601 format, e.g., "2024-01-01"). Great for recent content.',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published before this date (ISO 8601 format).',
                },
                startCrawlDate: {
                  type: 'string',
                  description:
                    'Only include results discovered by EXA after this date (ISO 8601). Use for newest indexed content.',
                },
                endCrawlDate: {
                  type: 'string',
                  description:
                    'Only include results discovered by EXA before this date (ISO 8601).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only search these domains (e.g., ["arxiv.org", "github.com", "nature.com"]).',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude results from these domains.',
                },
                includeText: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Required text that MUST appear in results (up to 5 words). Filter for specific terms.',
                },
                excludeText: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Text that must NOT appear in results (up to 5 words). Filter out unwanted content.',
                },
                livecrawl: {
                  type: 'string',
                  enum: ['always', 'preferred', 'fallback', 'never'],
                  description:
                    'Content freshness mode: "always" (slowest but freshest - for real-time/breaking news), "preferred" (default - fresh with fallback), "fallback" (cache first), "never" (fastest, cached only).',
                },
                additionalQueries: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Additional query variations for deep search. Only works with type="deep". Expands search coverage.',
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
                    'Maximum characters for text content per result (default: 3000). Increase for more context.',
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
                startCrawlDate: input.startCrawlDate,
                endCrawlDate: input.endCrawlDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
                includeText: input.includeText,
                excludeText: input.excludeText,
                livecrawl: input.livecrawl as ExaSearchInput['livecrawl'],
                additionalQueries: input.additionalQueries,
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
              'Find up to 100 similar pages to a given URL. Perfect for discovering related articles, research papers, competitors, alternative sources, or expanding on a topic. Returns semantically similar pages from across the web with fresh content via livecrawling. Use after finding a great source to expand research.',
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
                    'Number of similar results to return (1-100). Default is 10. Use higher values for comprehensive research.',
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
                    'tweet',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter similar results by content type.',
                },
                livecrawl: {
                  type: 'string',
                  enum: ['always', 'preferred', 'fallback', 'never'],
                  description:
                    'Content freshness: "always" (freshest), "preferred" (default - fresh with fallback), "fallback" (cache first), "never" (fastest).',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only include similar content published after this date (ISO 8601).',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only include similar content published before this date (ISO 8601).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only find similar content from these domains.',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude similar content from these domains.',
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
                maxCharacters: {
                  type: 'number',
                  description:
                    'Maximum characters for text content per result (default: 3000).',
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
                livecrawl: input.livecrawl as ExaFindSimilarInput['livecrawl'],
                startPublishedDate: input.startPublishedDate,
                endPublishedDate: input.endPublishedDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
                useHighlights: input.useHighlights,
                useSummary: input.useSummary,
                maxCharacters: input.maxCharacters,
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
              'Get a direct, synthesized answer to a question with cited sources. EXA searches the web, analyzes content, and provides a comprehensive answer. Best for: single factual questions ("Who is CEO of X?", "When was Y released?"), summaries of recent events, or quick explanations. NOT for deep multi-faceted research (use exa_search for that). Returns the answer plus source citations.',
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
                    'tweet',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter sources by content type for more focused answers.',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only use sources published after this date (ISO 8601). Great for recent information.',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only use sources published before this date (ISO 8601).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only use sources from these domains (e.g., ["wikipedia.org", "arxiv.org"]).',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude sources from these domains.',
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
                startPublishedDate: input.startPublishedDate,
                endPublishedDate: input.endPublishedDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
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
        ]
      : []),
  ]
}

