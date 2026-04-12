/**
 * Test the complexity analyzer
 */

const { estimateComplexity } = require('./complexity-analyzer');

function test(name, code, expected) {
    const result = estimateComplexity(code);
    const pass = result.complexity === expected;
    console.log(`${pass ? '✓' : '✗'} ${name}`);
    if (!pass) {
        console.log(`  Expected: ${expected}`);
        console.log(`  Got: ${result.complexity}`);
    }
    return pass;
}

console.log('Testing complexity analyzer...\n');

// Test 1: O(1)
test('O(1) - empty main',
`int main() { return 0; }`,
'O(1)');

// Test 2: O(n)
test('O(n) - single loop',
`void process(int n) {
    for (int i = 0; i < n; i++) {
        printf("%d", i);
    }
}`,
'O(n)');

// Test 3: O(n^2)
test('O(n^2) - nested loops',
`void process(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            printf("%d", i*j);
        }
    }
}`,
'O(n^2)');

// Test 4: O(n^3)
test('O(n^3) - triple nested',
`void process(int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            for (int k = 0; k < n; k++) {
                printf("%d", i*j*k);
            }
        }
    }
}`,
'O(n^3)');

// Test 5: O(n log n)
test('O(n log n) - sort',
`#include <algorithm>
void process(vector<int> v) {
    sort(v.begin(), v.end());
}`,
'O(n log n)');

// Test 6: O(log n)
test('O(log n) - binary search',
`#include <algorithm>
bool search(vector<int> v, int target) {
    return binary_search(v.begin(), v.end(), target);
}`,
'O(log n)');

console.log('\nAll tests complete!');