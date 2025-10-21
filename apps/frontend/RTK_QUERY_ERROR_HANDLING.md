# RTK Query Error Handling Documentation

## Overview

Phase 2 of the error handling implementation has enhanced RTK Query with:

1. **Custom BaseQuery with Error Interceptor** - Transforms API errors into user-friendly Persian messages
2. **Retry Logic with Exponential Backoff** - Automatically retries failed requests (max 3 attempts)
3. **Request/Response Logging** - Comprehensive logging for development and production monitoring

---

## What Was Added

### File Modified
- `apps/frontend/src/lib/store/services/api.ts`

### New Features

#### 1. Error Message Mapper

Converts HTTP status codes and network errors into user-friendly Persian messages:

```typescript
const getErrorMessage = (status: number | string): string => {
  // Network errors: FETCH_ERROR, PARSING_ERROR, TIMEOUT_ERROR
  // HTTP errors: 400, 401, 403, 404, 429, 500, 502, 503, etc.
}
```

**Supported Errors:**
- `FETCH_ERROR`: خطا در اتصال به سرور (Connection failed)
- `PARSING_ERROR`: خطا در پردازش داده‌ها (Data parsing failed)
- `TIMEOUT_ERROR`: زمان درخواست به پایان رسید (Request timeout)
- `400`: درخواست نامعتبر است (Bad request)
- `401`: لطفاً وارد حساب کاربری خود شوید (Unauthorized)
- `403`: شما دسترسی به این بخش را ندارید (Forbidden)
- `404`: داده مورد نظر یافت نشد (Not found)
- `429`: تعداد درخواست‌ها بیش از حد مجاز است (Rate limited)
- `500/502/503`: Server errors

#### 2. Request ID Generator

Each request gets a unique ID for tracing:

```typescript
const generateRequestId = (): string => {
  requestIdCounter += 1
  return `req_${Date.now()}_${requestIdCounter}`
}
```

#### 3. Enhanced Base Query

- **Timeout**: 30 seconds for all requests
- **Request logging**: Logs endpoint, method, timestamp in development
- **Response logging**: Logs success/error with duration and details
- **Error monitoring**: Placeholder for production error logging (Sentry, LogRocket)

#### 4. Retry Logic

- **Max retries**: 3 attempts
- **Exponential backoff**: 1s, 2s, 4s (max 10s)
- **Smart retry**: Only retries on network errors and 5xx errors
- **No retry on 4xx**: Client errors (except 429 rate limit) won't retry

---

## How It Works

### Request Flow

```
1. Component calls useGetCurrenciesQuery()
   ↓
2. RTK Query initiates request
   ↓
3. baseQueryWithRetry wraps request
   ↓
4. baseQueryWithInterceptor logs and executes
   ↓
5. baseQuery (fetchBaseQuery) makes HTTP request
   ↓
6. Response returned
   ↓
7. Logged with request ID and duration
   ↓
8. If error and retryable → retry with backoff
   ↓
9. If error and not retryable → fail immediately
   ↓
10. Result returned to component
```

### Development Console Output

**Successful Request:**
```
🔵 [req_1234567890_1] API Request: {
  endpoint: "/navasan/currencies",
  method: "GET",
  timestamp: "2025-01-21T10:30:00.000Z"
}

🟢 [req_1234567890_1] API Success (234ms): {
  endpoint: "/navasan/currencies",
  dataKeys: ["usd_sell", "eur", "gbp", "cad", "aud"]
}
```

**Failed Request with Retry:**
```
🔵 [req_1234567890_2] API Request: { ... }

🔴 [req_1234567890_2] API Error (5002ms): {
  endpoint: "/navasan/crypto",
  status: 503,
  error: { ... },
  message: "سرور در حال حاضر در دسترس نیست. لطفاً بعداً تلاش کنید."
}

⏳ Retry attempt 1 after 1000ms
⏳ Retry attempt 2 after 2000ms
⏳ Retry attempt 3 after 4000ms
```

---

## Using Error Messages in Components

### Helper Function

A new `getApiErrorMessage` function is exported for use in components:

```typescript
import { getApiErrorMessage } from '@/lib/store/services/api'

function MyComponent() {
  const { data, error, isLoading } = useGetCurrenciesQuery()

  if (error) {
    const errorMessage = getApiErrorMessage(error)
    return <div className="error">{errorMessage}</div>
  }

  // ... rest of component
}
```

### Manual Error Handling

You can also access the error status directly:

```typescript
function MyComponent() {
  const { data, error, isLoading } = useGetCurrenciesQuery()

  if (error) {
    if (error.status === 404) {
      return <div>داده‌ای یافت نشد</div>
    }

    if (error.status === 'FETCH_ERROR') {
      return <div>خطا در اتصال به اینترنت</div>
    }

    // Generic error
    return <div>{getApiErrorMessage(error)}</div>
  }

  // ... rest of component
}
```

---

## Configuration

### Timeout Configuration

Default: **30 seconds**

To change:
```typescript
const baseQuery = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  timeout: 60000, // 60 seconds
})
```

### Retry Configuration

Default: **3 retries**

To change:
```typescript
const baseQueryWithRetry = retry(
  // ... query function
  {
    maxRetries: 5, // Change number of retries
  }
)
```

### Retry Conditions

Current behavior:
- ✅ Retry on network errors (FETCH_ERROR, TIMEOUT_ERROR)
- ✅ Retry on server errors (500, 502, 503)
- ✅ Retry on rate limit (429)
- ❌ Don't retry on client errors (400, 401, 403, 404)

To customize:
```typescript
// In retry function
if (result.error) {
  const status = result.error.status

  // Example: Also retry on 401 (authentication)
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429 && status !== 401) {
    retry.fail(result.error)
  }
}
```

---

## Production Error Logging

Currently has placeholder for error monitoring integration.

### Integrating Sentry (TODO)

1. Install Sentry:
```bash
npm install @sentry/nextjs
```

2. Update error logging in `api.ts`:
```typescript
import * as Sentry from '@sentry/nextjs'

// In baseQueryWithInterceptor
if (result.error && process.env.NODE_ENV === 'production') {
  Sentry.captureException(new Error(`API Error: ${result.error.status}`), {
    extra: {
      requestId,
      endpoint: typeof args === 'string' ? args : args.url,
      status: result.error.status,
      duration,
    },
  })
}
```

### Integrating LogRocket (TODO)

```typescript
import LogRocket from 'logrocket'

if (result.error && process.env.NODE_ENV === 'production') {
  LogRocket.captureException(new Error(`API Error: ${result.error.status}`), {
    extra: { requestId, endpoint, status, duration }
  })
}
```

---

## Testing

### Test Network Error

Stop the backend server and observe:
- Request logged with 🔵
- Error logged with 🔴
- Retry attempts logged with ⏳
- User-friendly error message displayed

### Test Server Error (500)

Create a test endpoint that returns 500:
```typescript
// In backend
@Get('test-error')
testError() {
  throw new HttpException('Test error', HttpStatus.INTERNAL_SERVER_ERROR)
}
```

Observe retry behavior in console.

### Test Client Error (404)

Request a non-existent endpoint:
```typescript
const { error } = useGetLatestRatesQuery()
```

Change endpoint to `/navasan/invalid` - should fail immediately without retries.

---

## Performance Considerations

### Request Logging Overhead

- **Development**: Minimal impact, logs are helpful for debugging
- **Production**: Logging is disabled except for errors

### Retry Logic

- **Network errors**: Retries can add 7+ seconds (1s + 2s + 4s)
- **User experience**: Better to retry than fail immediately
- **Trade-off**: Slight delay vs. reliability

### Request ID Generation

- **Memory**: Negligible (single counter variable)
- **CPU**: Minimal (simple increment and string template)

---

## Best Practices

### ✅ DO

- Use `getApiErrorMessage(error)` for user-facing error messages
- Let RTK Query handle retries automatically
- Check error.status for specific error handling
- Wrap API calls in Error Boundaries for extra safety

### ❌ DON'T

- Don't implement custom retry logic on top of this
- Don't ignore errors - always display user-friendly messages
- Don't retry manually - let RTK Query handle it
- Don't disable error logging in production

---

## Error Handling Checklist

When using RTK Query in components:

- [ ] Handle `isLoading` state
- [ ] Handle `error` state with `getApiErrorMessage(error)`
- [ ] Show user-friendly error messages in Persian
- [ ] Wrap component in ErrorBoundary for extra safety
- [ ] Consider offline state (Phase 6)
- [ ] Test with network disabled
- [ ] Test with backend stopped

---

## What's Next (Future Phases)

- [x] **Phase 1**: Critical Error Boundaries ✅
- [x] **Phase 2**: Enhanced RTK Query Error Handling ✅
- [ ] **Phase 3**: Environment Variable Validation
- [ ] **Phase 4**: Error Type Safety
- [ ] **Phase 5**: Error Monitoring Integration (Sentry/LogRocket)
- [ ] **Phase 6**: Network Status Handling (offline mode)
- [ ] **Phase 7**: Improved User-Facing Errors
- [ ] **Phase 8**: Stale Data Handling

---

## Summary

**Phase 2 Complete!** ✅

Your RTK Query now has:
- ✅ 30-second timeout on all requests
- ✅ Automatic retry with exponential backoff (max 3 attempts)
- ✅ User-friendly Persian error messages
- ✅ Comprehensive development logging
- ✅ Request ID tracking for debugging
- ✅ Production error monitoring placeholders
- ✅ Type-safe error handling
- ✅ Helper function for components (`getApiErrorMessage`)

All changes are in `apps/frontend/src/lib/store/services/api.ts` (api.ts:1-220).
