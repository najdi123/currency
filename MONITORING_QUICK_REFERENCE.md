# Monitoring Quick Reference Guide

## Cache Monitoring Endpoints

### GET /cache/metrics
```bash
curl http://localhost:4000/cache/metrics
```
Returns detailed cache performance metrics with namespace breakdown (OHLC vs Historical).

**Key Fields:**
- `total.hitRate` - Overall cache effectiveness (target: 70-90%)
- `byNamespace` - Performance by cache type

---

### GET /cache/stats
```bash
curl http://localhost:4000/cache/stats
```
Returns cache infrastructure statistics.

**Key Fields:**
- `type` - "redis" or "memory"
- `keys` - Number of cached items
- `memoryUsage` - Redis memory usage (if applicable)

---

### GET /cache/health
```bash
curl http://localhost:4000/cache/health
```
Comprehensive cache health check combining metrics and stats.

---

### POST /cache/metrics/reset
```bash
curl -X POST http://localhost:4000/cache/metrics/reset
```
Reset cache metrics counters (doesn't clear cached data).

---

## Performance Monitoring Endpoints

### GET /metrics/performance
```bash
curl http://localhost:4000/metrics/performance
```
**Most comprehensive endpoint** - Returns:
- ✅ Cache metrics
- ✅ Rate limit usage
- ✅ Health status
- ✅ Failure tracking
- ✅ Timestamp

**Use for:** Main monitoring dashboard, Grafana integration

---

### GET /metrics/health
```bash
curl http://localhost:4000/metrics/health
```
Quick health check with warnings and critical issues.

**Response States:**
- `healthy: true` - All systems operational
- `warnings: [...]` - Minor issues detected
- `criticalIssues: [...]` - Immediate attention needed

---

### GET /metrics/cache
```bash
curl http://localhost:4000/metrics/cache
```
Cache metrics only (alternative to `/cache/metrics`).

---

### GET /metrics/rate-limit
```bash
curl http://localhost:4000/metrics/rate-limit
```
Rate limiting statistics with top consumers.

---

### GET /metrics/failures
```bash
curl http://localhost:4000/metrics/failures
```
Database and snapshot failure tracking.

---

### POST /metrics/reset
```bash
curl -X POST http://localhost:4000/metrics/reset
```
Reset all metrics counters (cache, rate limit, failures).

---

## Quick Health Check Script

```bash
#!/bin/bash
# health-check.sh

BASE_URL="http://localhost:4000"

echo "=== Cache Health ==="
curl -s $BASE_URL/cache/health | jq '.status, .metrics.total.hitRate'

echo -e "\n=== Application Health ==="
curl -s $BASE_URL/metrics/health | jq '.healthy, .warnings, .criticalIssues'

echo -e "\n=== Performance Summary ==="
curl -s $BASE_URL/metrics/performance | jq '{
  cacheHitRate: .cache.hitRate,
  cacheType: .health.healthy,
  totalRequests: .cache.totalRequests,
  timestamp: .timestamp
}'
```

---

## Monitoring Checklist

**Daily:**
- [ ] Check `/metrics/health` - Should be healthy: true
- [ ] Verify cache hit rate > 70%
- [ ] Check for warnings or critical issues

**Weekly:**
- [ ] Review `/metrics/performance` for trends
- [ ] Check top rate limit consumers
- [ ] Verify Redis memory usage < 10MB

**When Issues Arise:**
- [ ] Check `/cache/health` for Redis connectivity
- [ ] Review `/metrics/failures` for error patterns
- [ ] Check logs for detailed error messages

---

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Cache Hit Rate | < 70% | < 50% |
| Cache Errors | > 5/hour | > 50/hour |
| Snapshot Failures | 3 consecutive | 10 consecutive |
| DB Failures | 3 consecutive | 10 consecutive |
| Rate Limit Exhaustion | > 10/hour | > 100/hour |

---

## Common Scenarios

### Scenario 1: Low Cache Hit Rate
```bash
# Check detailed metrics
curl http://localhost:4000/cache/metrics | jq '.byNamespace'

# If navasan:ohlc is low: Check OHLC TTL (should be 1 hour)
# If navasan:historical is low: Check historical TTL (should be 24 hours)
```

### Scenario 2: Redis Connection Issues
```bash
# Check cache type
curl http://localhost:4000/cache/stats | jq '.type'

# If "memory": Redis is down, check:
redis-cli ping  # Should return PONG
```

### Scenario 3: Health Warnings
```bash
# Get detailed failure info
curl http://localhost:4000/metrics/failures

# Check health recommendations
curl http://localhost:4000/metrics/health
```

---

## Integration Examples

### Prometheus
```yaml
scrape_configs:
  - job_name: 'currency-api'
    metrics_path: '/metrics/performance'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:4000']
```

### Uptime Monitor
```bash
# Monitor health endpoint every 60 seconds
*/1 * * * * curl -f http://localhost:4000/metrics/health || alert
```

### Grafana Panel Query
```
Cache Hit Rate: cache_hits / (cache_hits + cache_misses) * 100
```

---

**Created:** 2025-01-22
**Version:** 1.0
**Endpoints:** 10 total (4 cache + 6 metrics)
