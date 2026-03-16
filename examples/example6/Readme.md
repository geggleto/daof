# Security Org

### Usage
```npx daof run examples/example6/org.yaml --workflow=full_audit --input='{"target_code_path":"<point to code>"}' -vvv --timeout=6000000``

**export CURSOR_API_KEY** the shell needs to have the api key in it.

### Outputs
- 3 Auditors = 3 Reports
- 1 Aggregator
All in the findings directory where the code lives.