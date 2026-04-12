/**
 * Complexity Analyzer for C++ Code
 * Uses heuristic pattern detection
 */

function stripCommentsAndStrings(code) {
  let result = "";
  let i = 0;
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let inString = false;
  let inChar = false;

  while (i < code.length) {
    const curr = code[i];
    const next = code[i + 1];

    if (inSingleLineComment) {
      if (curr === "\n") {
        inSingleLineComment = false;
        result += "\n";
      }
      i++;
      continue;
    }

    if (inMultiLineComment) {
      if (curr === "*" && next === "/") {
        inMultiLineComment = false;
        i += 2;
      } else {
        if (curr === "\n") result += "\n";
        i++;
      }
      continue;
    }

    if (inString) {
      if (curr === "\\" && next) {
        i += 2;
        result += "  ";
        continue;
      }
      if (curr === '"') {
        inString = false;
      }
      result += " ";
      i++;
      continue;
    }

    if (inChar) {
      if (curr === "\\" && next) {
        i += 2;
        result += "  ";
        continue;
      }
      if (curr === "'") {
        inChar = false;
      }
      result += " ";
      i++;
      continue;
    }

    if (curr === "/" && next === "/") {
      inSingleLineComment = true;
      i += 2;
      continue;
    }

    if (curr === "/" && next === "*") {
      inMultiLineComment = true;
      i += 2;
      continue;
    }

    if (curr === '"') {
      inString = true;
      result += " ";
      i++;
      continue;
    }

    if (curr === "'") {
      inChar = true;
      result += " ";
      i++;
      continue;
    }

    result += curr;
    i++;
  }

  return result;
}

function findFunctionName(code) {
  const match = code.match(
    /\b(?:int|long long|void|bool|double|float|string|auto)\s+([a-zA-Z_]\w*)\s*\([^;{}]*\)\s*\{/
  );
  return match ? match[1] : null;
}

function estimateLoopFactor(header) {
  const normalized = header.replace(/\s+/g, " ");

  if (/[*\/]=\s*2|=\s*\w+\s*[*\/]\s*2|>>=|<<=/.test(normalized)) {
    return {
      factor: "log n",
      score: 1,
      reason: "Detected logarithmic loop update pattern"
    };
  }

  if (/<\s*n|<=\s*n|\bsize\s*\(\)|\.size\s*\(\)|<\s*m|<=\s*m/.test(normalized)) {
    return {
      factor: "n",
      score: 2,
      reason: "Detected loop bounded by n/m or container size"
    };
  }

  if (/<\s*1\s*<<|<\s*\(\s*1\s*<<|<=\s*\(\s*1\s*<<|<\s*pow\s*\(\s*2/.test(normalized)) {
    return {
      factor: "2^n",
      score: 6,
      reason: "Detected bitmask/subset-style loop"
    };
  }

  if (/<\s*\w+/.test(normalized)) {
    return {
      factor: "n",
      score: 1,
      reason: "Detected variable-bounded loop"
    };
  }

  return {
    factor: "1",
    score: 0,
    reason: "Loop bound unclear"
  };
}

function analyzeLoops(code) {
  const lines = code.split("\n");
  const loopStack = [];
  let maxNestedLinearLoops = 0;
  let hasLogLoop = false;
  let hasExponentialLoop = false;
  const reasons = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    const forMatch = line.match(/\bfor\s*\((.*)\)/);
    const whileMatch = line.match(/\bwhile\s*\((.*)\)/);

    if (forMatch || whileMatch) {
      const header = forMatch ? forMatch[1] : whileMatch[1];
      const info = estimateLoopFactor(header);

      if (info.factor === "n") {
        loopStack.push("n");
      } else if (info.factor === "log n") {
        hasLogLoop = true;
        loopStack.push("log n");
      } else if (info.factor === "2^n") {
        hasExponentialLoop = true;
        loopStack.push("2^n");
      } else {
        loopStack.push("1");
      }

      if (info.reason) reasons.push(info.reason);

      const currentLinearDepth = loopStack.filter((x) => x === "n").length;
      if (currentLinearDepth > maxNestedLinearLoops) {
        maxNestedLinearLoops = currentLinearDepth;
      }
    }

    const closeCount = (line.match(/\}/g) || []).length;
    for (let i = 0; i < closeCount && loopStack.length > 0; i++) {
      loopStack.pop();
    }
  }

  return {
    maxNestedLinearLoops,
    hasLogLoop,
    hasExponentialLoop,
    reasons
  };
}

function analyzeKnownCalls(code) {
  return {
    hasSort: /\bsort\s*\(/.test(code),
    hasStableSort: /\bstable_sort\s*\(/.test(code),
    hasBinarySearch:
      /\bbinary_search\s*\(|\blower_bound\s*\(|\bupper_bound\s*\(/.test(code),
    hasPriorityQueue: /\bpriority_queue\b/.test(code),
    hasMapSet: /\bmap\b|\bset\b|\bmultiset\b/.test(code),
    hasUnordered: /\bunordered_map\b|\bunordered_set\b/.test(code)
  };
}

function analyzeRecursion(code) {
  const fn = findFunctionName(code);
  if (!fn) {
    return { recursive: false, multiRecursive: false, reason: null };
  }

  const matches = code.match(new RegExp(`\\b${fn}\\s*\\(`, "g")) || [];
  const callCount = Math.max(0, matches.length - 1);

  if (callCount >= 2) {
    return {
      recursive: true,
      multiRecursive: true,
      reason: `Detected multiple recursive calls to ${fn}()`
    };
  }

  if (callCount === 1) {
    return {
      recursive: true,
      multiRecursive: false,
      reason: `Detected recursive call to ${fn}()`
    };
  }

  return { recursive: false, multiRecursive: false, reason: null };
}

function estimateComplexity(cppCode) {
  const cleaned = stripCommentsAndStrings(cppCode);
  const loopInfo = analyzeLoops(cleaned);
  const calls = analyzeKnownCalls(cleaned);
  const recursion = analyzeRecursion(cleaned);

  const reasons = [];
  reasons.push(...loopInfo.reasons);
  if (recursion.reason) reasons.push(recursion.reason);
  if (calls.hasSort || calls.hasStableSort) reasons.push("Detected sort-like call");
  if (calls.hasBinarySearch) reasons.push("Detected binary-search-like call");
  if (calls.hasPriorityQueue) reasons.push("Detected priority_queue usage");
  if (calls.hasMapSet) reasons.push("Detected map/set usage");
  if (calls.hasUnordered) reasons.push("Detected unordered hash structure usage");

  let complexity = "O(1)";
  let confidence = 0.55;

  if (loopInfo.hasExponentialLoop) {
    complexity = "O(2^n)";
    confidence = 0.85;
  } else if (recursion.multiRecursive) {
    complexity = "O(2^n)";
    confidence = 0.7;
  } else if (loopInfo.maxNestedLinearLoops >= 3) {
    complexity = "O(n^3)";
    confidence = 0.83;
  } else if (loopInfo.maxNestedLinearLoops === 2) {
    complexity = "O(n^2)";
    confidence = 0.84;
  } else if (loopInfo.maxNestedLinearLoops === 1 && loopInfo.hasLogLoop) {
    complexity = "O(n log n)";
    confidence = 0.76;
  } else if (loopInfo.maxNestedLinearLoops === 1) {
    complexity = "O(n)";
    confidence = 0.8;
  } else if (loopInfo.hasLogLoop) {
    complexity = "O(log n)";
    confidence = 0.72;
  }

  if ((calls.hasSort || calls.hasStableSort) && complexity === "O(n)") {
    complexity = "O(n log n)";
    confidence = Math.max(confidence, 0.86);
  } else if ((calls.hasSort || calls.hasStableSort) && complexity === "O(1)") {
    complexity = "O(n log n)";
    confidence = 0.8;
  } else if ((calls.hasSort || calls.hasStableSort) && complexity === "O(n^2)") {
    complexity = "O(n^2 log n)";
    confidence = 0.62;
  }

  if (calls.hasBinarySearch && complexity === "O(1)") {
    complexity = "O(log n)";
    confidence = Math.max(confidence, 0.78);
  }

  if (calls.hasMapSet && complexity === "O(n)") {
    reasons.push("Map/set operations may add logarithmic factors");
  }

  if (calls.hasUnordered && complexity === "O(n)") {
    reasons.push("unordered_map/set usually keeps average linear pass complexity");
  }

  let tleRisk = "Low";
  if (/O\(n\^3\)|O\(2\^n\)|O\(n\^2 log n\)/.test(complexity)) {
    tleRisk = "High";
  } else if (/O\(n\^2\)|O\(n log n\)/.test(complexity)) {
    tleRisk = "Medium";
  }

  const summary = [
    `Estimated Complexity: ${complexity}`,
    `Confidence: ${Math.round(confidence * 100)}%`,
    `TLE Risk: ${tleRisk}`
  ].join("\n");

  return {
    complexity,
    confidence: Number(confidence.toFixed(2)),
    tleRisk,
    summary,
    reasons: [...new Set(reasons)].slice(0, 6)
  };
}

module.exports = {
  estimateComplexity
};