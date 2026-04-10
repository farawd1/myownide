/**
 * Complexity Estimator for C++ Code
 * Heuristic asymptotic complexity analyzer
 */

function stripCommentsAndStrings(code) {
    let result = '';
    let inString = false;
    let inChar = false;
    let inComment = false;
    let inBlockComment = false;
    let i = 0;
    
    while (i < code.length) {
        // Handle block comments
        if (inBlockComment) {
            if (code[i] === '*' && code[i + 1] === '/') {
                inBlockComment = false;
                i += 2;
            } else {
                i++;
            }
            continue;
        }
        
        // Handle line comments
        if (inComment) {
            if (code[i] === '\n') {
                inComment = false;
                result += '\n';
            }
            i++;
            continue;
        }
        
        // Check for string
        if (code[i] === '"' && code[i - 1] !== '\\') {
            inString = !inString;
            result += ' ';
            i++;
            continue;
        }
        
        // Check for char
        if (code[i] === "'" && code[i - 1] !== '\\') {
            inChar = !inChar;
            result += ' ';
            i++;
            continue;
        }
        
        // Skip strings/chars content
        if (inString || inChar) {
            result += ' ';
            i++;
            continue;
        }
        
        // Check for block comment start
        if (code[i] === '/' && code[i + 1] === '*') {
            inBlockComment = true;
            i += 2;
            continue;
        }
        
        // Check for line comment start
        if (code[i] === '/' && code[i + 1] === '/') {
            inComment = true;
            i += 2;
            continue;
        }
        
        result += code[i];
        i++;
    }
    
    return result;
}

function detectLoops(code) {
    const loops = [];
    // Find all for and while loops with their bodies
    const loopPattern = /(?:for|while)\s*\(([^)]*)\)\s*\{/g;
    let match;
    
    while ((match = loopPattern.exec(code)) !== null) {
        const start = match.index;
        const init = match[1]; // loop init/condition
        
        // Find the matching closing brace
        let braceStart = start + match[0].length - 1; // position of '{'
        let depth = 1;
        let bodyEnd = braceStart;
        
        for (let i = braceStart + 1; i < code.length; i++) {
            if (code[i] === '{') depth++;
            if (code[i] === '}') {
                depth--;
                if (depth === 0) {
                    bodyEnd = i;
                    break;
                }
            }
        }
        
        const body = code.slice(braceStart + 1, bodyEnd);
        
        loops.push({
            start: start,
            end: bodyEnd,
            body: body,
            init: init
        });
    }
    
    return loops;
}

function detectNestedLoopDepth(code) {
    const loops = detectLoops(code);
    if (loops.length === 0) return 0;
    
    // Check for nested loops by looking for loop keywords in bodies
    let maxDepth = 1;
    
    for (const loop of loops) {
        const nestedDepth = detectNestedLoopDepth(loop.body);
        maxDepth = Math.max(maxDepth, nestedDepth + 1);
    }
    
    // Also check by simple count of nested for/while keywords
    const forCount = (code.match(/for\s*\(/g) || []).length;
    const whileCount = (code.match(/while\s*\(/g) || []).length;
    const totalLoops = forCount + whileCount;
    
    // If no nested structures found but loops exist, default to 1
    if (maxDepth === 1 && totalLoops > 0) {
        // Simple heuristic based on loop count
        if (totalLoops >= 3) return 3;
        if (totalLoops === 2) return 2;
        return 1;
    }
    
    return maxDepth;
}

function detectLogarithmicPattern(code) {
    // Common patterns: i *= 2, i /= 2, i << 1, i >> 1, i += 1 while i < n
    const logPatterns = [
        /i\s*\*=\s*2/,
        /i\s*\/=\s*2/,
        /i\s*>>=\s*1/,
        /i\s*<<=\s*1/,
        /i\s*=\s*i\s*\*\s*2/,
        /i\s*=\s*i\s*>\s*\d+/,
        /while\s*\([^)]*<\s*n/,
        /while\s*\([^)]*>\s*0/,
    ];
    
    for (const pattern of logPatterns) {
        if (pattern.test(code)) {
            return true;
        }
    }
    
    // Check for binary search patterns
    if (code.includes('lower_bound') || code.includes('upper_bound') || 
        code.includes('binary_search')) {
        return true;
    }
    
    return false;
}

function detectSortCall(code) {
    const sortPatterns = [
        /sort\s*\(/,
        /stable_sort\s*\(/,
        /partial_sort\s*\(/,
        /nth_element\s*\(/,
        /qsort\s*\(/,
        /std::sort/,
        /std::stable_sort/,
    ];
    
    for (const pattern of sortPatterns) {
        if (pattern.test(code)) {
            return true;
        }
    }
    
    return false;
}

function detectBinarySearch(code) {
    const bsPatterns = [
        /binary_search\s*\(/,
        /lower_bound\s*\(/,
        /upper_bound\s*\(/,
        /equal_range\s*\(/,
        /std::binary_search/,
        /std::lower_bound/,
    ];
    
    for (const pattern of bsPatterns) {
        if (pattern.test(code)) {
            return true;
        }
    }
    
    return false;
}

function detectRecursion(code) {
    // Look for function definitions with recursive calls
    // Simple heuristic: check for function name appearing inside its own body
    const funcPattern = /(?:void|int|char|float|double|long|bool|string|auto)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let match;
    
    while ((match = funcPattern.exec(code)) !== null) {
        const funcName = match[1];
        if (!funcName || funcName.length < 2) continue;
        
        // Find the function body
        let braceDepth = 0;
        let bodyStart = match.index + match[0].length;
        let bodyEnd = -1;
        
        for (let i = bodyStart; i < code.length; i++) {
            if (code[i] === '{') braceDepth++;
            if (code[i] === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    bodyEnd = i;
                    break;
                }
            }
        }
        
        if (bodyEnd === -1) continue;
        
        const body = code.slice(bodyStart, bodyEnd);
        
        // Check if the function calls itself
        try {
            const callPattern = new RegExp(`\\b${funcName}\\s*\\(`);
            if (callPattern.test(body)) {
                return true;
            }
        } catch (e) {
            // Invalid regex, skip
            continue;
        }
    }
    
    return false;
}

function estimateComplexity(code) {
    const cleanedCode = stripCommentsAndStrings(code);
    
    // Detect features
    const hasNestedLoops = detectNestedLoopDepth(cleanedCode);
    const hasLogPattern = detectLogarithmicPattern(cleanedCode);
    const hasSort = detectSortCall(cleanedCode);
    const hasBinarySearch = detectBinarySearch(cleanedCode);
    const hasRecursion = detectRecursion(cleanedCode);
    const loops = detectLoops(cleanedCode);
    
    const reasons = [];
    let complexity = 'O(1)';
    let confidence = 0.95;
    let tleRisk = 'Low';
    
    // Determine complexity based on detected patterns
    if (hasSort && !hasNestedLoops) {
        complexity = 'O(n log n)';
        confidence = 0.85;
        tleRisk = 'Low';
        reasons.push('Detected sort-like call');
    } else if (hasBinarySearch) {
        complexity = 'O(log n)';
        confidence = 0.80;
        tleRisk = 'Low';
        reasons.push('Detected binary search call');
    } else if (hasLogPattern && loops.length > 0) {
        complexity = 'O(log n)';
        confidence = 0.75;
        tleRisk = 'Low';
        reasons.push('Detected logarithmic loop pattern');
    } else if (hasRecursion && !hasNestedLoops) {
        complexity = 'O(n)';
        confidence = 0.60;
        tleRisk = 'Medium';
        reasons.push('Detected simple recursion');
    } else if (hasNestedLoops >= 3) {
        complexity = 'O(n^3)';
        confidence = 0.85;
        tleRisk = 'High';
        reasons.push('Detected deeply nested loops (3+)');
    } else if (hasNestedLoops === 2) {
        complexity = 'O(n^2)';
        confidence = 0.82;
        tleRisk = 'Medium';
        reasons.push('Detected nested loops bounded by n');
        if (!hasLogPattern) {
            reasons.push('No logarithmic reduction pattern found');
        }
    } else if (hasNestedLoops === 1) {
        complexity = 'O(n)';
        confidence = 0.80;
        tleRisk = 'Low';
        reasons.push('Detected single loop bounded by n');
    } else if (loops.length > 0) {
        complexity = 'O(n)';
        confidence = 0.75;
        tleRisk = 'Low';
        reasons.push('Detected loop, assuming linear');
    } else {
        complexity = 'O(1)';
        confidence = 0.95;
        tleRisk = 'Low';
        reasons.push('No loops or recursion detected');
    }
    
    // Adjust confidence based on clarity
    if (reasons.length < 2) {
        confidence = Math.min(confidence, 0.5);
    }
    
    // Adjust TLE risk based on complexity
    if (complexity.includes('n^3') || complexity.includes('n!')) {
        tleRisk = 'High';
    } else if (complexity.includes('n^2')) {
        tleRisk = 'Medium';
    } else {
        tleRisk = 'Low';
    }
    
    return {
        complexity,
        confidence,
        tleRisk,
        reasons
    };
}

function analyzeComplexity(language, code) {
    if (language !== 'cpp' && language !== 'c++') {
        return {
            complexity: 'Unknown',
            confidence: 0.1,
            tleRisk: 'Unknown',
            summary: 'Language not supported by MVP. Complexity estimator is optimized for C++.',
            reasons: ['MVP optimized for C++ only']
        };
    }
    
    const result = estimateComplexity(code);
    
    const summary = `Estimated Complexity: ${result.complexity}\nConfidence: ${Math.round(result.confidence * 100)}%\nTLE Risk: ${result.tleRisk}`;
    
    return {
        complexity: result.complexity,
        confidence: result.confidence,
        tleRisk: result.tleRisk,
        summary,
        reasons: result.reasons
    };
}

module.exports = { analyzeComplexity, estimateComplexity };