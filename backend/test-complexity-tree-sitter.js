const { estimateComplexity } = require("./complexity-tree-sitter");

const tests = [
  {
    name: "sequential loops",
    code: `
      #include <bits/stdc++.h>
      using namespace std;
      int main() {
          int n; cin >> n;
          for (int i = 0; i < n; i++) cout << i;
          for (int i = 0; i < n; i++) cout << i;
      }
    `,
    expected: "O(n)",
  },
  {
    name: "nested loops",
    code: `
      #include <bits/stdc++.h>
      using namespace std;
      int main() {
          int n; cin >> n;
          for (int i = 0; i < n; i++) {
              for (int j = 0; j < n; j++) {
                  cout << i + j;
              }
          }
      }
    `,
    expected: "O(n^2)",
  },
  {
    name: "sort + scan",
    code: `
      #include <bits/stdc++.h>
      using namespace std;
      int main() {
          int n; cin >> n;
          vector<int> a(n);
          sort(a.begin(), a.end());
          for (int i = 0; i < n; i++) cout << a[i];
      }
    `,
    expected: "O(n log n)",
  },
  {
    name: "binary search",
    code: `
      #include <bits/stdc++.h>
      using namespace std;
      int main() {
          int l = 0, r = n - 1;
          while (l <= r) {
              int mid = (l + r) / 2;
              if (ok(mid)) r = mid - 1;
              else l = mid + 1;
          }
      }
    `,
    expected: "O(log n)",
  },
  {
    name: "bfs",
    code: `
      #include <bits/stdc++.h>
      using namespace std;
      vector<vector<int>> g;
      int main() {
          queue<int> q;
          vector<int> used(1000);
          q.push(0);
          used[0] = 1;
          while (!q.empty()) {
              int v = q.front();
              q.pop();
              for (auto to : g[v]) {
                  if (!used[to]) {
                      used[to] = 1;
                      q.push(to);
                  }
              }
          }
      }
    `,
    expected: "O(V + E)",
  },
  {
    name: "dfs",
    code: `
      #include <bits/stdc++.h>
      using namespace std;
      vector<vector<int>> g;
      vector<int> used;
      void dfs(int v) {
          used[v] = 1;
          for (auto to : g[v]) {
              if (!used[to]) dfs(to);
          }
      }
    `,
    expected: "O(V + E)",
  },
  {
    name: "dijkstra",
    code: `
      #include <bits/stdc++.h>
      using namespace std;
      vector<vector<pair<int,int>>> g;
      int main() {
          vector<long long> dist(n, 1e18);
          priority_queue<pair<long long,int>, vector<pair<long long,int>>, greater<pair<long long,int>>> pq;
          dist[0] = 0;
          pq.push({0, 0});
          while (!pq.empty()) {
              auto [d, v] = pq.top();
              pq.pop();
              for (auto [to, w] : g[v]) {
                  if (dist[to] > d + w) {
                      dist[to] = d + w;
                      pq.push({dist[to], to});
                  }
              }
          }
      }
    `,
    expected: "O((V + E) log V)",
  },
];

console.log("=== Tree-sitter Complexity Estimator Tests ===\n");

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = estimateComplexity(test.code);
  const ok = result.complexity === test.expected;
  if (ok) passed++;
  else failed++;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${test.name}`);
  console.log("  expected:", test.expected);
  console.log("  actual:  ", result.complexity);
  console.log("  pattern: ", result.pattern);
}

console.log("\n=== Results ===");
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}`);
