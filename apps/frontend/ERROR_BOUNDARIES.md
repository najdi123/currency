# Error Boundaries Documentation

## Overview

This project now has comprehensive error handling with three levels of error boundaries:

1. **Global Error Boundary** (`global-error.tsx`) - Catches errors in root layout
2. **Page Error Boundary** (`error.tsx`) - Catches errors in page components
3. **Reusable Error Boundary** (`ErrorBoundary.tsx`) - Wrap specific sections

## Files Created

```
apps/frontend/src/
├── app/
│   ├── global-error.tsx    ← Global error boundary (last resort)
│   └── error.tsx            ← Page-level error boundary
└── components/
    └── ErrorBoundary.tsx    ← Reusable component
```

---

## 1. Global Error Boundary (`global-error.tsx`)

**When it activates**: Only when errors occur in the root layout itself.

**Features**:
- Full-screen error fallback
- Reset button to reload app
- Return to home button
- Error details in development mode
- Ready for error logging integration

**You don't need to do anything** - Next.js automatically uses this file!

---

## 2. Page Error Boundary (`error.tsx`)

**When it activates**: Errors in page components and their children.

**Features**:
- User-friendly error UI
- Retry without full page reload
- Return to home button
- Error stack trace in development
- Better UX than global error

**You don't need to do anything** - Next.js automatically uses this file for the route!

---

## 3. Reusable Error Boundary (`ErrorBoundary.tsx`)

**When to use**: Wrap specific sections that might fail independently.

### Basic Usage

```tsx
import ErrorBoundary from '@/components/ErrorBoundary'

function MyPage() {
  return (
    <div>
      <h1>My Page</h1>

      {/* Wrap risky components */}
      <ErrorBoundary boundaryName="CurrencySection">
        <CurrencyList />
      </ErrorBoundary>
    </div>
  )
}
```

### With Custom Fallback UI

```tsx
import ErrorBoundary from '@/components/ErrorBoundary'

function MyPage() {
  return (
    <ErrorBoundary
      boundaryName="CryptoSection"
      fallback={(error, reset) => (
        <div className="bg-yellow-50 p-4 rounded">
          <h3>Crypto data unavailable</h3>
          <button onClick={reset}>Retry</button>
        </div>
      )}
    >
      <CryptoList />
    </ErrorBoundary>
  )
}
```

### With Error Logging

```tsx
import ErrorBoundary from '@/components/ErrorBoundary'

function MyPage() {
  return (
    <ErrorBoundary
      boundaryName="ImportantSection"
      onError={(error, errorInfo) => {
        console.error('Error in ImportantSection:', error)
        // Send to monitoring service
        // Sentry.captureException(error, { extra: errorInfo })
      }}
    >
      <ImportantComponent />
    </ErrorBoundary>
  )
}
```

### Using the HOC (Higher-Order Component)

```tsx
import { withErrorBoundary } from '@/components/ErrorBoundary'

function CryptoWidget() {
  // This might throw errors
  return <div>Crypto prices...</div>
}

// Wrap it with error boundary
export default withErrorBoundary(CryptoWidget, {
  boundaryName: 'CryptoWidget',
  onError: (error) => console.error('CryptoWidget failed:', error)
})
```

---

## Error Boundary Hierarchy

```
┌─────────────────────────────────────┐
│   Global Error Boundary             │  ← Catches root layout errors
│   (global-error.tsx)                │
│  ┌───────────────────────────────┐  │
│  │  Page Error Boundary          │  │  ← Catches page errors
│  │  (error.tsx)                  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Reusable Error         │  │  │  ← Catches section errors
│  │  │  Boundary               │  │  │
│  │  │  (ErrorBoundary.tsx)   │  │  │
│  │  │                         │  │  │
│  │  │  <YourComponent />      │  │  │
│  │  │                         │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Error handling flow**:
1. Error occurs in `<YourComponent />`
2. Reusable ErrorBoundary catches it first (if wrapped)
3. If not caught, Page Error Boundary catches it
4. If still not caught, Global Error Boundary catches it (last resort)

---

## Testing Error Boundaries

### Test in Development

Create a component that throws an error:

```tsx
// Test component
function ErrorTestComponent() {
  throw new Error('Test error!')
  return <div>This will never render</div>
}

// Use it
function TestPage() {
  return (
    <ErrorBoundary boundaryName="ErrorTest">
      <ErrorTestComponent />
    </ErrorBoundary>
  )
}
```

### Test Different Scenarios

1. **Synchronous error** (caught ✅):
   ```tsx
   function BadComponent() {
     throw new Error('Immediate error')
   }
   ```

2. **Async error in useEffect** (caught ✅):
   ```tsx
   function BadComponent() {
     useEffect(() => {
       throw new Error('Error in useEffect')
     }, [])
     return <div>Component</div>
   }
   ```

3. **Event handler error** (NOT caught ❌):
   ```tsx
   function BadComponent() {
     const handleClick = () => {
       throw new Error('Click error') // NOT caught by Error Boundary!
     }
     return <button onClick={handleClick}>Click</button>
   }
   ```
   **Solution**: Wrap event handlers in try-catch

4. **Async function error** (NOT caught ❌):
   ```tsx
   function BadComponent() {
     const fetchData = async () => {
       throw new Error('Async error') // NOT caught!
     }
     return <button onClick={fetchData}>Fetch</button>
   }
   ```
   **Solution**: Use try-catch or catch promise

---

## Best Practices

### ✅ DO

- Wrap independent sections with `<ErrorBoundary>`
- Provide meaningful `boundaryName` for debugging
- Use custom fallback UI for better UX
- Log errors in production for monitoring
- Reset error state when user tries again

### ❌ DON'T

- Don't wrap every single component (too granular)
- Don't use Error Boundaries for expected errors (use try-catch)
- Don't rely on Error Boundaries for event handler errors
- Don't ignore errors - always log them

---

## Error Logging Integration (TODO)

To integrate with error monitoring services like Sentry:

```tsx
// lib/errorLogger.ts
export const errorLogger = {
  logError: (error: Error, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error, { extra: context })
    }
    console.error('Error logged:', error, context)
  }
}
```

Then use in error boundaries:

```tsx
import { errorLogger } from '@/lib/errorLogger'

// In componentDidCatch or onError callback
errorLogger.logError(error, {
  boundary: 'MyBoundary',
  componentStack: errorInfo.componentStack,
})
```

---

## Next Steps (Future Phases)

- [ ] Phase 2: Enhanced RTK Query error handling
- [ ] Phase 3: Environment variable validation
- [ ] Phase 4: Error type safety
- [ ] Phase 5: Error monitoring integration (Sentry)
- [ ] Phase 6: Network status handling
- [ ] Phase 7: Improved error messages
- [ ] Phase 8: Stale data handling

---

## Questions?

If something doesn't work as expected:
1. Check browser console for errors
2. Make sure you're using `'use client'` directive if needed
3. Verify error is thrown during render (not in event handler)
4. Check the error boundary hierarchy

**Phase 1 Complete!** ✅
