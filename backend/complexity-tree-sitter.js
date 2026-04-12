const Parser = require("tree-sitter");
const Cpp = require("tree-sitter-cpp");

const parser = new Parser();
parser.setLanguage(Cpp);

const COST_ORDER = [
  "O(1)",
  "O(log n)",
  "O(n)",
  "O(n log n)",
  "O(n^2)",
  "O(n^2 log n)",
  "O(n^3)",
  "O(V + E)",
  "O((V + E) log V)",
  "O(2^n)",
  "Unknown",
];

function maxCost(a, b) {
  const ia = COST_ORDER.indexOf(a);
  const ib = COST_ORDER.indexOf(b);
  if (ia === -1) return b;
  if (ib === -1) return a;
  return ia >= ib ? a : b;
}

function multiplyCost(loopCost, bodyCost) {
  if (loopCost === "O(1)") return bodyCost;
  if (bodyCost === "O(1)") return loopCost;

  if (loopCost === "O(n)" && bodyCost === "O(n)") return "O(n^2)";
  if (loopCost === "O(n)" && bodyCost === "O(n^2)") return "O(n^3)";
  if (loopCost === "O(n)" && bodyCost === "O(log n)") return "O(n log n)";
  if (loopCost === "O(log n)" && bodyCost === "O(n)") return "O(n log n)";
  if (loopCost === "O(n)" && bodyCost === "O(n log n)") return "O(n^2 log n)";
  if (loopCost === "O(log n)" && bodyCost === "O(log n)") return "O(log n)";
  if (loopCost === "O(log n)" && bodyCost === "O(n log n)") return "O(n log n)";
  if (loopCost === "O(n)" && bodyCost === "O(V + E)") return "Unknown";
  if (loopCost === "O(n)" && bodyCost === "O((V + E) log V)") return "Unknown";

  return maxCost(loopCost, bodyCost);
}

function textOf(node, source) {
  return source.slice(node.startIndex, node.endIndex);
}

function getChildren(node) {
  const out = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    out.push(node.namedChild(i));
  }
  return out;
}

function walk(node, visitor) {
  visitor(node);
  for (let i = 0; i < node.namedChildCount; i++) {
    walk(node.namedChild(i), visitor);
  }
}

function findFirst(node, predicate) {
  if (predicate(node)) return node;
  for (let i = 0; i < node.namedChildCount; i++) {
    const found = findFirst(node.namedChild(i), predicate);
    if (found) return found;
  }
  return null;
}

function detectSortCalls(root, source) {
  let found = false;
  walk(root, (node) => {
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      if (!fn) return;
      const fnText = textOf(fn, source);
      if (/\b(sort|stable_sort)\b/.test(fnText)) {
        found = true;
      }
    }
  });
  return found;
}

function detectBinarySearch(root, source) {
  let hasMid = false;
  let hasBoundsLoop = false;
  let hasBoundUpdate = false;
  let hasLibCall = false;

  walk(root, (node) => {
    const t = textOf(node, source);

    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      if (fn && /\b(lower_bound|upper_bound|binary_search)\b/.test(textOf(fn, source))) {
        hasLibCall = true;
      }
    }

    if (node.type === "binary_expression" || node.type === "assignment_expression" || node.type === "init_declarator") {
      if (/\bmid\b/.test(t) && /(l\s*\+\s*r|left\s*\+\s*right)/.test(t)) {
        hasMid = true;
      }
    }

    if (node.type === "while_statement" || node.type === "for_statement") {
      if (/\b(l|left)\b.*\b(r|right)\b|\b(r|right)\b.*\b(l|left)\b/.test(t)) {
        hasBoundsLoop = true;
      }
    }

    if (/\b(l|left)\s*=\s*mid\s*\+\s*1\b|\b(r|right)\s*=\s*mid\s*-\s*1\b|\b(r|right)\s*=\s*mid\b|\b(l|left)\s*=\s*mid\b/.test(t)) {
      hasBoundUpdate = true;
    }
  });

  if (hasLibCall) {
    return {
      matched: true,
      complexity: "O(log n)",
      pattern: "Binary Search",
      confidence: 0.92,
      reasons: ["Detected standard binary-search library call"],
    };
  }

  if (hasMid && hasBoundsLoop && hasBoundUpdate) {
    return {
      matched: true,
      complexity: "O(log n)",
      pattern: "Binary Search",
      confidence: 0.86,
      reasons: ["Detected midpoint computation and shrinking search bounds"],
    };
  }

  return { matched: false };
}

function detectGraphAdjacency(root, source) {
  let adjacencyLoop = false;
  walk(root, (node) => {
    if (node.type === "for_range_loop" || node.type === "for_statement") {
      const t = textOf(node, source);
      if (/\bg\s*\[.*\]/.test(t) || /\badj\s*\[.*\]/.test(t) || /\bgraph\s*\[.*\]/.test(t)) {
        adjacencyLoop = true;
      }
    }
  });
  return adjacencyLoop;
}

function detectBfs(root, source) {
  const src = source;
  const hasQueue = /\bqueue\s*</.test(src);
  const hasVisited = /\bvis(it(ed)?)?\b|\bused\b/.test(src);
  const hasAdjLoop = detectGraphAdjacency(root, source);

  if (hasQueue && hasAdjLoop) {
    return {
      matched: true,
      complexity: "O(V + E)",
      pattern: "BFS Graph Traversal",
      confidence: hasVisited ? 0.9 : 0.82,
      reasons: [
        "Detected queue-based traversal",
        "Detected adjacency-list neighbor iteration",
      ],
    };
  }

  return { matched: false };
}

function detectDfs(root, source) {
  const src = source;
  const hasAdjLoop = detectGraphAdjacency(root, source);
  let recursiveDfs = false;

  walk(root, (node) => {
    if (node.type === "function_definition") {
      const declarator = node.childForFieldName("declarator");
      if (!declarator) return;
      const nameNode = findFirst(declarator, (n) => n.type === "identifier");
      if (!nameNode) return;
      const name = textOf(nameNode, source);
      if (!/dfs/i.test(name)) return;

      const body = node.childForFieldName("body");
      if (body && new RegExp("\\b" + name + "\\s*\\(").test(textOf(body, source))) {
        recursiveDfs = true;
      }
    }
  });

  if (recursiveDfs && hasAdjLoop) {
    return {
      matched: true,
      complexity: "O(V + E)",
      pattern: "DFS Graph Traversal",
      confidence: 0.9,
      reasons: [
        "Detected recursive DFS-style function",
        "Detected adjacency-list neighbor iteration",
      ],
    };
  }

  return { matched: false };
}

function detectDijkstra(root, source) {
  const src = source;
  const hasPQ = /\bpriority_queue\s*</.test(src);
  const hasDist = /\bdist\b/.test(src);
  const hasAdjLoop = detectGraphAdjacency(root, source);
  const hasRelax = /\bdist\s*\[.*\]\s*>\s*.*\+\s*/.test(src) || /\bdist\s*\[.*\]\s*=\s*.*\+\s*/.test(src);

  if (hasPQ && hasDist && hasAdjLoop && hasRelax) {
    return {
      matched: true,
      complexity: "O((V + E) log V)",
      pattern: "Dijkstra",
      confidence: 0.91,
      reasons: [
        "Detected priority_queue usage",
        "Detected distance array updates",
        "Detected graph edge relaxation pattern",
      ],
    };
  }

  return { matched: false };
}

function detectTwoPointers(root, source) {
  const src = source;
  const hasTwoPointers = /\b(l|left)\b/.test(src) && /\b(r|right)\b/.test(src);
  const hasWhile = /\bwhile\s*\(/.test(src);

  if (hasTwoPointers && hasWhile) {
    return {
      matched: true,
      complexity: "O(n)",
      pattern: "Two Pointers / Sliding Window",
      confidence: 0.72,
      reasons: [
        "Detected two boundary pointers with while loop",
      ],
    };
  }

  return { matched: false };
}

function estimateLoopBound(loopText) {
  const t = loopText.replace(/\s+/g, " ");

  if (/<\s*\(?\s*1\s*<<|<=\s*\(?\s*1\s*<</.test(t)) {
    return { cost: "O(2^n)", reason: "Detected bitmask-style loop bound" };
  }

  if (/[*\/]=\s*2|>>=|<<=|\b\w+\s*=\s*\w+\s*\/\s*2\b|\b\w+\s*=\s*\w+\s*\*\s*2\b/.test(t)) {
    return { cost: "O(log n)", reason: "Detected logarithmic loop update pattern" };
  }

  if (/<\s*n|<=\s*n|<\s*m|<=\s*m|\.size\s*\(\)|size\s*\(\)/.test(t)) {
    return { cost: "O(n)", reason: "Detected loop bounded by n/m or container size" };
  }

  if (/<\s*\w+|<=\s*\w+/.test(t)) {
    return { cost: "O(n)", reason: "Detected variable-bounded loop" };
  }

  return { cost: "O(n)", reason: "Loop bound unclear, defaulting to linear estimate" };
}

function analyzeStatement(node, source, reasons) {
  if (!node) return "O(1)";

  if (
    node.type === "compound_statement" ||
    node.type === "translation_unit"
  ) {
    let total = "O(1)";
    for (const child of getChildren(node)) {
      total = maxCost(total, analyzeStatement(child, source, reasons));
    }
    return total;
  }

  if (node.type === "for_statement" || node.type === "while_statement" || node.type === "for_range_loop") {
    const loopText = textOf(node, source);
    const bound = estimateLoopBound(loopText);
    reasons.push(bound.reason);

    const body = node.childForFieldName("body") || getChildren(node).slice(-1)[0] || null;
    const bodyCost = analyzeStatement(body, source, reasons);
    return multiplyCost(bound.cost, bodyCost);
  }

  if (node.type === "if_statement") {
    const cons = node.childForFieldName("consequence");
    const alt = node.childForFieldName("alternative");
    const c1 = analyzeStatement(cons, source, reasons);
    const c2 = alt ? analyzeStatement(alt, source, reasons) : "O(1)";
    return maxCost(c1, c2);
  }

  if (node.type === "call_expression") {
    const fn = node.childForFieldName("function");
    const fnText = fn ? textOf(fn, source) : "";
    if (/\b(sort|stable_sort)\b/.test(fnText)) {
      reasons.push("Detected sort-like call");
      return "O(n log n)";
    }
    if (/\b(lower_bound|upper_bound|binary_search)\b/.test(fnText)) {
      reasons.push("Detected binary-search-like call");
      return "O(log n)";
    }
    return "O(1)";
  }

  let total = "O(1)";
  for (const child of getChildren(node)) {
    total = maxCost(total, analyzeStatement(child, source, reasons));
  }
  return total;
}

function detectPatterns(root, source) {
  const detectors = [
    detectDijkstra,
    detectBfs,
    detectDfs,
    detectBinarySearch,
    detectTwoPointers,
  ];

  for (const detector of detectors) {
    const result = detector(root, source);
    if (result.matched) return result;
  }

  return { matched: false };
}

function tleRiskFor(complexity) {
  if (["O(2^n)", "O(n^3)", "O(n^2 log n)"].includes(complexity)) return "High";
  if (["O(n^2)", "O((V + E) log V)", "O(n log n)"].includes(complexity)) return "Medium";
  return "Low";
}

function estimateComplexity(code) {
  const source = code || "";
  const tree = parser.parse(source);
  const root = tree.rootNode;

  const patternResult = detectPatterns(root, source);
  if (patternResult.matched) {
    return {
      complexity: patternResult.complexity,
      confidence: Number(patternResult.confidence.toFixed(2)),
      pattern: patternResult.pattern,
      tleRisk: tleRiskFor(patternResult.complexity),
      summary: [
        "Estimated Complexity: " + patternResult.complexity,
        "Detected Pattern: " + patternResult.pattern,
        "Confidence: " + Math.round(patternResult.confidence * 100) + "%",
        "TLE Risk: " + tleRiskFor(patternResult.complexity),
      ].join("\n"),
      reasons: patternResult.reasons,
    };
  }

  const reasons = [];
  const structural = analyzeStatement(root, source, reasons);

  let complexity = structural;
  let confidence = 0.72;
  let pattern = "Structural Analysis";

  if (detectSortCalls(root, source) && structural === "O(n)") {
    complexity = "O(n log n)";
    confidence = 0.86;
    pattern = "Sort + Linear Scan";
    reasons.push("Detected sort-like call dominating a linear pass");
  }

  return {
    complexity,
    confidence: Number(confidence.toFixed(2)),
    pattern,
    tleRisk: tleRiskFor(complexity),
    summary: [
      "Estimated Complexity: " + complexity,
      "Detected Pattern: " + pattern,
      "Confidence: " + Math.round(confidence * 100) + "%",
      "TLE Risk: " + tleRiskFor(complexity),
    ].join("\n"),
    reasons: [...new Set(reasons)].slice(0, 8),
  };
}

module.exports = {
  estimateComplexity,
};
