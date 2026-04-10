/**
 * Simple tests for complexity analyzer
 */

const { analyzeComplexity, estimateComplexity } = require('./complexity');

function test(name, code, expected) {
    const result = analyzeComplexity('cpp', code);
    const pass = result.complexity === expected.complexity;
    console.log(`${pass ? '✓' : '✗'} ${name}`);
    if (!pass) {
        console.log(`  Expected: ${expected.complexity}`);
        console.log(`  Got: ${result.complexity}`);
    }
    return pass;
}

console.log('Running complexity analyzer tests...\n');

// Test 1: O(1) - no loops
test('O(1) - simple return', 
`int main() {
    return 0;
}`,
{ complexity: 'O(1)' });

// Test 2: O(n) - single loop
test('O(n) - single for loop',
`void process(int n) {
    for (int i = 0; i < n; i++) {
        printf("%d", i);
    }
}`,
{ complexity: 'O(n)' });

// Test 3: O(n^2) - nested loops
test('O(n^2) - nested loops',
`void process(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            printf("%d", i*j);
        }
    }
}`,
{ complexity: 'O(n^2)' });

// Test 4: O(n^3) - triple nested loops
test('O(n^3) - triple nested loops',
`void process(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            for (int k = 0; k < n; k++) {
                printf("%d", i*j*k);
            }
        }
    }
}`,
{ complexity: 'O(n^3)' });

// Test 5: O(n log n) - sort
test('O(n log n) - sort',
`#include <algorithm>
void process(vector<int> v) {
    sort(v.begin(), v.end());
}`,
{ complexity: 'O(n log n)' });

// Test 6: O(log n) - binary search
test('O(log n) - binary search',
`#include <algorithm>
bool search(vector<int> v, int target) {
    return binary_search(v.begin(), v.end(), target);
}`,
{ complexity: 'O(log n)' });

// Test 7: Unsupported language
test('Unsupported language - python',
`def process(n):
    for i in range(n):
        print(i)`,
{ complexity: 'Unknown' });

// Directly test the language check
const pyResult = analyzeComplexity('python', 'def foo(): pass');
console.log(`  Python language test: ${pyResult.complexity === 'Unknown' ? '✓' : '✗'} (got ${pyResult.complexity})`);

// Test 8: Comments should be ignored
test('O(n) - comment stripped',
`// This is a comment
void process(int n) {
    for (int i = 0; i < n; i++) {
        printf("%d", i);
    }
}`,
{ complexity: 'O(n)' });

console.log('\nDone!');