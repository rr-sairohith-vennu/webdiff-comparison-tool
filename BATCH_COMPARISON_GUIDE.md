# Batch Comparison Guide

## Overview

WebDiff now supports **batch comparison** - compare multiple URL pairs in a single request! This is perfect for testing multiple pages or flows at once.

## Features

✅ **Multiple URL pairs** - Compare 2, 5, 10+ URL pairs in one request
✅ **Parallel batching** - Processes 2 pairs at a time for speed + safety
✅ **Button states** - Each pair can have its own button clicks
✅ **Error handling** - Continues even if one pair fails
✅ **Progress tracking** - Real-time updates via Socket.io

## API Endpoint

```
POST http://localhost:4000/api/compare-batch
```

## Request Format

```json
{
  "pairs": [
    {
      "url1": "https://prod.com/page1",
      "url2": "https://preview.com/page1",
      "description": "Homepage",
      "buttons": "Login,Sign Up"
    },
    {
      "url1": "https://prod.com/page2",
      "url2": "https://preview.com/page2",
      "description": "Checkout page"
    }
  ]
}
```

### Fields

- `pairs` (required): Array of URL pair objects
- `url1` (required): Production/baseline URL
- `url2` (required): Preview/comparison URL
- `description` (optional): Description for this pair
- `buttons` (optional): Comma-separated button names to click

## Example Usage

### cURL

```bash
curl -X POST http://localhost:4000/api/compare-batch \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": [
      {
        "url1": "https://www.rakuten.com",
        "url2": "https://preview-www.rakuten.com",
        "description": "Homepage"
      },
      {
        "url1": "https://www.rakuten.com/cart",
        "url2": "https://preview-www.rakuten.com/cart",
        "description": "Shopping cart",
        "buttons": "Update Qty,Remove Item"
      }
    ]
  }'
```

### Node.js

```javascript
const response = await fetch('http://localhost:4000/api/compare-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pairs: [
      { url1: 'https://prod.com/page1', url2: 'https://preview.com/page1' },
      { url1: 'https://prod.com/page2', url2: 'https://preview.com/page2' }
    ]
  })
});

const result = await response.json();
console.log(`Compared ${result.result.totalPairs} pairs`);
console.log(`Total comparisons: ${result.result.totalComparisons}`);
```

### Test Script

Run the included test script:

```bash
node test-batch.js
```

## Response Format

```json
{
  "success": true,
  "result": {
    "timestamp": 1729025678000,
    "type": "batch",
    "totalPairs": 2,
    "totalComparisons": 5,
    "pairs": [
      {
        "pairNumber": 1,
        "url1": "https://prod.com/page1",
        "url2": "https://preview.com/page1",
        "description": "Homepage",
        "buttonActions": ["Login", "Sign Up"],
        "comparisons": [
          {
            "timestamp": 1729025678001,
            "clickedButton": "Default View",
            "differences": [...],
            "screenshots": {...}
          },
          {
            "timestamp": 1729025678002,
            "clickedButton": "Login",
            "differences": [...],
            "screenshots": {...}
          },
          {
            "timestamp": 1729025678003,
            "clickedButton": "Sign Up",
            "differences": [...],
            "screenshots": {...}
          }
        ],
        "totalComparisons": 3
      },
      {
        "pairNumber": 2,
        "url1": "https://prod.com/page2",
        "url2": "https://preview.com/page2",
        "description": "Checkout",
        "buttonActions": [],
        "comparisons": [
          {
            "timestamp": 1729025678004,
            "clickedButton": "Default View",
            "differences": [...],
            "screenshots": {...}
          }
        ],
        "totalComparisons": 1
      }
    ]
  }
}
```

## Performance

### Parallel Batching

The API processes **2 pairs at a time** in parallel:

```
Batch 1: [Pair 1, Pair 2] → 15-20 seconds
Batch 2: [Pair 3, Pair 4] → 15-20 seconds
Batch 3: [Pair 5, Pair 6] → 15-20 seconds
```

**Example timing:**
- 6 URL pairs (default view only): ~60 seconds
- 6 URL pairs (with 2 buttons each): ~180 seconds
- vs Sequential: Would take 360 seconds (2x slower!)

### Resource Usage

Per browser instance:
- Memory: ~500MB
- CPU: 1 core at 80-100%
- Network: Depends on page size

**Safe limits:**
- ✅ Up to 10 pairs: Safe
- ⚠️ 10-20 pairs: May slow down
- ❌ 20+ pairs: Split into multiple requests

## Error Handling

If a pair fails, the batch continues:

```json
{
  "pairNumber": 2,
  "error": "Identical URLs",
  "url1": "https://example.com",
  "url2": "https://example.com"
}
```

Common errors:
- `"Missing url1 or url2"` - Invalid pair
- `"Identical URLs"` - Both URLs are the same
- `"Navigation timeout"` - Page took too long to load

## Use Cases

### 1. Multi-Page Testing

Test entire user flows:

```json
{
  "pairs": [
    { "url1": "https://prod.com/", "url2": "https://preview.com/" },
    { "url1": "https://prod.com/search", "url2": "https://preview.com/search" },
    { "url1": "https://prod.com/product", "url2": "https://preview.com/product" },
    { "url1": "https://prod.com/cart", "url2": "https://preview.com/cart" },
    { "url1": "https://prod.com/checkout", "url2": "https://preview.com/checkout" }
  ]
}
```

### 2. A/B Testing

Compare different variations:

```json
{
  "pairs": [
    { "url1": "https://site.com/variant-a", "url2": "https://site.com/variant-b" },
    { "url1": "https://site.com/control", "url2": "https://site.com/experiment" }
  ]
}
```

### 3. Cross-Browser/Device

Compare same page across environments:

```json
{
  "pairs": [
    {
      "url1": "https://site.com?device=desktop",
      "url2": "https://site.com?device=mobile",
      "description": "Desktop vs Mobile"
    }
  ]
}
```

## Results

Results are saved to:
```
results/batch_<timestamp>.json
```

Access via:
- **File system**: Read the JSON file directly
- **API**: `GET /api/results/batch_<timestamp>`

## Tips

1. **Group related pages** - Put similar pages together for better organization
2. **Limit button states** - More buttons = longer time per pair
3. **Split large batches** - For 20+ pairs, split into multiple requests
4. **Use descriptions** - Makes results easier to understand
5. **Test incrementally** - Start with 2-3 pairs, then scale up

## Rollback

If the batch feature causes issues, revert with:

```bash
git checkout HEAD~1 server.js
npm restart
```

The single-pair endpoint (`/api/compare`) still works as before!

## Questions?

Check the main README or test with `test-batch.js`
