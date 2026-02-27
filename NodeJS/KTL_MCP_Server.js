const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const ktlFilePath = path.join(repoRoot, 'KTL.js');
const instructionsPath = path.join(repoRoot, 'KTL_AI_Instructions.md');
const apiDocsPath = path.join(repoRoot, 'Docs', 'KTL_API.md');

const FUNCTION_LIMIT = 50;
const GOAL_KEYWORD_MODULE_HINTS = [
  { terms: ['api', 'record', 'records', 'rest', 'http'], modules: ['api'] },
  { terms: ['field', 'column', 'input'], modules: ['fields'] },
  { terms: ['view', 'table', 'grid', 'form'], modules: ['views'] },
  { terms: ['scene', 'page', 'navigation'], modules: ['scenes'] },
  { terms: ['log', 'debug', 'trace', 'error'], modules: ['log'] },
  { terms: ['storage', 'cache', 'localstorage', 'persist'], modules: ['storage'] },
  { terms: ['bulk', 'mass'], modules: ['bulkOps'] },
  { terms: ['user', 'preference', 'prefs'], modules: ['userPrefs'] }
];
// Matches `this.<module> = (function () { ... return { ... }; })();` module definitions.
const MODULE_REGEX = /this\.(\w+)\s*=\s*\(function\s*\(\)\s*\{([\s\S]*?)return\s*\{([\s\S]*?)\}\s*;\s*\}\)\(\)\s*;/g;
const METHOD_REGEX = /^\s*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/gm;
const PROPERTY_FUNCTION_REGEX = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s+)?function\s*\(([^)]*)\)/gm;

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function parseKtlFunctions(ktlJs) {
  const modules = new Map();

  let moduleMatch;
  while ((moduleMatch = MODULE_REGEX.exec(ktlJs)) !== null) {
    const moduleName = moduleMatch[1];
    const returnBody = moduleMatch[3] || '';
    const entries = [];

    let methodMatch;
    while ((methodMatch = METHOD_REGEX.exec(returnBody)) !== null) {
      const methodName = methodMatch[1];
      const args = (methodMatch[2] || '').trim();
      const absoluteIndex = moduleMatch.index + moduleMatch[0].indexOf(methodMatch[0]);
      entries.push({
        module: moduleName,
        name: methodName,
        signature: `ktl.${moduleName}.${methodName}(${args})`,
        line: getLineNumber(ktlJs, absoluteIndex)
      });
    }

    let propertyFnMatch;
    while ((propertyFnMatch = PROPERTY_FUNCTION_REGEX.exec(returnBody)) !== null) {
      const methodName = propertyFnMatch[1];
      if (entries.some(item => item.name === methodName)) continue;
      const args = (propertyFnMatch[2] || '').trim();
      const absoluteIndex = moduleMatch.index + moduleMatch[0].indexOf(propertyFnMatch[0]);
      entries.push({
        module: moduleName,
        name: methodName,
        signature: `ktl.${moduleName}.${methodName}(${args})`,
        line: getLineNumber(ktlJs, absoluteIndex)
      });
    }

    if (entries.length) {
      modules.set(moduleName, entries.sort((a, b) => a.name.localeCompare(b.name)));
    }
  }

  return modules;
}

function parseApiMethods(apiMarkdown) {
  const lines = apiMarkdown.split('\n');
  const methods = [];

  for (const line of lines) {
    const headerMatch = line.match(/^###\s+`([^`]+)`/);
    if (!headerMatch) continue;
    const raw = headerMatch[1];
    const methodMatch = raw.match(/^(?:ktl\.api\.)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/);
    if (!methodMatch) continue;

    methods.push({
      module: 'api',
      name: methodMatch[1],
      signature: `ktl.api.${methodMatch[1]}(${(methodMatch[2] || '').trim()})`,
      line: null
    });
  }

  return methods;
}

function buildKnowledgeBase() {
  const ktlJs = readText(ktlFilePath);
  const instructions = readText(instructionsPath);
  const apiMarkdown = readText(apiDocsPath);

  const modules = parseKtlFunctions(ktlJs);
  const apiMethods = parseApiMethods(apiMarkdown);
  if (apiMethods.length) {
    const current = modules.get('api') || [];
    const merged = [...current];
    for (const method of apiMethods) {
      if (!merged.some(item => item.name === method.name)) merged.push(method);
    }
    modules.set('api', merged.sort((a, b) => a.name.localeCompare(b.name)));
  }

  const allFunctions = [];
  for (const moduleEntries of modules.values()) {
    allFunctions.push(...moduleEntries);
  }

  return {
    modules,
    allFunctions,
    instructions
  };
}

const kb = buildKnowledgeBase();

function makeResultText(text) {
  return { content: [{ type: 'text', text }] };
}

function recommendFunctions(goal, limit) {
  const normalizedGoal = String(goal || '').trim().toLowerCase();
  const words = normalizedGoal.split(/[^a-z0-9_]+/).filter(word => word.length >= 3);

  const hintedModules = new Set();
  for (const hint of GOAL_KEYWORD_MODULE_HINTS) {
    if (hint.terms.some(term => normalizedGoal.includes(term))) {
      for (const moduleName of hint.modules) hintedModules.add(moduleName.toLowerCase());
    }
  }

  const scored = kb.allFunctions
    .map(item => {
      const loweredName = item.name.toLowerCase();
      const loweredSignature = item.signature.toLowerCase();
      let score = 0;

      for (const word of words) {
        if (loweredName.includes(word)) score += 3;
        if (loweredSignature.includes(word)) score += 1;
      }
      if (hintedModules.has(item.module.toLowerCase())) score += 2;

      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.signature.localeCompare(b.signature));

  return scored.slice(0, limit);
}

function handleToolCall(name, args = {}) {
  if (name === 'list_ktl_capabilities') {
    const moduleNames = Array.from(kb.modules.keys()).sort();
    const rows = moduleNames.map(moduleName => `- ${moduleName}: ${kb.modules.get(moduleName).length} function(s)`).join('\n');
    return makeResultText(`KTL modules and discovered functions:\n${rows}`);
  }

  if (name === 'search_ktl_functions') {
    const query = String(args.query || '').trim().toLowerCase();
    const moduleFilter = String(args.module || '').trim().toLowerCase();
    const parsedLimit = Number(args.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, FUNCTION_LIMIT)) : FUNCTION_LIMIT;

    let matches = kb.allFunctions;
    if (moduleFilter) {
      matches = matches.filter(item => item.module.toLowerCase() === moduleFilter);
    }
    if (query) {
      matches = matches.filter(item => item.name.toLowerCase().includes(query) || item.signature.toLowerCase().includes(query));
    }

    const output = matches
      .slice(0, limit)
      .map(item => `- ${item.signature}${item.line ? ` (KTL.js:${item.line})` : ''}`)
      .join('\n');

    if (!output) {
      return makeResultText('No matching KTL functions were found. Try a broader query or omit module filter.');
    }

    return makeResultText(`Matching KTL functions (${Math.min(matches.length, limit)} of ${matches.length}):\n${output}`);
  }

  if (name === 'get_ktl_guidance') {
    const guidance = kb.instructions
      .split('\n')
      .filter(line => /^- /.test(line) || /^## /.test(line))
      .slice(0, 30)
      .join('\n');
    return makeResultText(`KTL coding guidance summary:\n${guidance}`);
  }

  if (name === 'recommend_ktl_functions') {
    const goal = String(args.goal || '').trim();
    if (!goal) {
      return makeResultText('Provide a short goal in `goal` (for example: "update records in bulk and refresh a view").');
    }

    const parsedLimit = Number(args.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 15)) : 8;
    const recommendations = recommendFunctions(goal, limit);

    if (!recommendations.length) {
      return makeResultText('No strong recommendations found. Try adding domain terms like view, records, api, field, or storage.');
    }

    const output = recommendations
      .map(item => `- ${item.signature}${item.line ? ` (KTL.js:${item.line})` : ''}`)
      .join('\n');
    return makeResultText(`Recommended KTL functions for goal "${goal}":\n${output}`);
  }

  throw new Error(`Unknown tool: ${name}`);
}

function handleRequest(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'ktl-mcp-server',
          version: '1.0.0'
        },
        capabilities: {
          tools: {}
        }
      }
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'list_ktl_capabilities',
            description: 'List available KTL modules and discovered function counts.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'search_ktl_functions',
            description: 'Search KTL functions by name/signature and optional module.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search text for function names/signatures.' },
                module: { type: 'string', description: 'Optional module name (for example: core, views, api).' },
                limit: { type: 'number', description: `Maximum rows to return (1-${FUNCTION_LIMIT}).` }
              },
              additionalProperties: false
            }
          },
          {
            name: 'get_ktl_guidance',
            description: 'Get a concise summary of KTL coding conventions for code generation.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'recommend_ktl_functions',
            description: 'Suggest likely KTL functions from a plain-English goal.',
            inputSchema: {
              type: 'object',
              properties: {
                goal: { type: 'string', description: 'What you want to build with KTL.' },
                limit: { type: 'number', description: 'Maximum recommendations to return (1-15).' }
              },
              required: ['goal'],
              additionalProperties: false
            }
          }
        ]
      }
    };
  }

  if (method === 'tools/call') {
    try {
      const result = handleToolCall(params?.name, params?.arguments || {});
      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      const safeMessage = error?.message && error.message.startsWith('Unknown tool:') ? error.message : 'Tool execution failed';
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: safeMessage }
      };
    }
  }

  if (typeof id !== 'undefined') {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    };
  }

  return null;
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;

  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
    const raw = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!raw) continue;

    try {
      const request = JSON.parse(raw);
      const response = handleRequest(request);
      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    } catch (error) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' }
      }) + '\n');
    }
  }
});
