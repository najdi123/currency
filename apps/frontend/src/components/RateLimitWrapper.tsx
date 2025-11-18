'use client';

import { useEffect, useState } from 'react';
import { RateLimitError } from '@/components/RateLimit/RateLimitError';
import { setupRateLimitListener, RateLimitInfo } from '@/lib/api-client';

/**
 * Global wrapper component for rate limit error handling
 *
 * This component:
 * - Listens for 'rate-limit-exceeded' events from API client
 * - Displays the RateLimitError modal when rate limit is hit
 * - Provides retry functionality
 * - Refreshes the page after successful retry
 */
export function RateLimitWrapper({ children }: { children: React.ReactNode }) {
  const [rateLimitInfo, setRateLimitInfo] = useState<(RateLimitInfo & { data?: any }) | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Set up global rate limit event listener
    const cleanup = setupRateLimitListener((info) => {
      setRateLimitInfo(info);
      setShowModal(true);
    });

    return cleanup;
  }, []);

  const handleRetry = () => {
    // Close modal and refresh the page
    setShowModal(false);
    setRateLimitInfo(null);

    // Refresh after a short delay to allow modal to close smoothly
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  const handleClose = () => {
    setShowModal(false);
    setRateLimitInfo(null);
  };

  return (
    <>
      {children}
      {showModal && rateLimitInfo && (
        <RateLimitError
          retryAfter={rateLimitInfo.retryAfter}
          resetAt={rateLimitInfo.resetAt}
          onRetry={handleRetry}
          onClose={handleClose}
        />
      )}
    </>
  );
}
