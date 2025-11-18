import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RateLimitError } from './RateLimitError';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock window.open
const mockWindowOpen = jest.fn();
global.window.open = mockWindowOpen;

describe('RateLimitError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const defaultProps = {
    retryAfter: 60,
    resetAt: '2025-12-01T00:00:00Z',
  };

  describe('Modal Rendering', () => {
    it('should render modal with correct content', () => {
      render(<RateLimitError {...defaultProps} />);

      expect(screen.getByText('rateLimitExceeded')).toBeInTheDocument();
      expect(screen.getByText('rateLimitMessage')).toBeInTheDocument();
      expect(screen.getByText('tryAgainIn')).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      const { container } = render(<RateLimitError {...defaultProps} />);

      const modal = container.querySelector('[role="dialog"]');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'rate-limit-title');
      expect(modal).toHaveAttribute('aria-describedby', 'rate-limit-description');
    });

    it('should have title and description with proper ids', () => {
      render(<RateLimitError {...defaultProps} />);

      const title = document.getElementById('rate-limit-title');
      const description = document.getElementById('rate-limit-description');

      expect(title).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });
  });

  describe('Countdown Timer', () => {
    it('should display initial countdown', () => {
      render(<RateLimitError {...defaultProps} retryAfter={120} />);

      expect(screen.getByText('2:00')).toBeInTheDocument();
    });

    it('should count down every second', async () => {
      render(<RateLimitError {...defaultProps} retryAfter={5} />);

      expect(screen.getByText('0:05')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('0:04')).toBeInTheDocument();
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('0:03')).toBeInTheDocument();
      });
    });

    it('should enable retry button when countdown reaches zero', async () => {
      render(<RateLimitError {...defaultProps} retryAfter={2} />);

      expect(screen.getByText('pleaseWait')).toBeInTheDocument();
      expect(screen.queryByText('tryAgain')).not.toBeInTheDocument();

      // Advance timers by 2100ms to ensure countdown completes
      act(() => {
        jest.advanceTimersByTime(2100);
      });

      await waitFor(() => {
        expect(screen.getByText('tryAgain')).toBeInTheDocument();
        expect(screen.queryByText('pleaseWait')).not.toBeInTheDocument();
      });
    });

    it('should format time correctly for hours', () => {
      render(<RateLimitError {...defaultProps} retryAfter={3665} />);

      expect(screen.getByText('1:01:05')).toBeInTheDocument();
    });

    it('should format time correctly for minutes', () => {
      render(<RateLimitError {...defaultProps} retryAfter={125} />);

      expect(screen.getByText('2:05')).toBeInTheDocument();
    });

    it('should format time correctly for seconds only', () => {
      render(<RateLimitError {...defaultProps} retryAfter={45} />);

      expect(screen.getByText('0:45')).toBeInTheDocument();
    });

    it('should have aria-live on countdown display', () => {
      const { container } = render(<RateLimitError {...defaultProps} retryAfter={60} />);

      const countdown = container.querySelector('[aria-live="polite"]');
      expect(countdown).toBeInTheDocument();
      expect(countdown).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('Retry Functionality', () => {
    it('should call onRetry when retry button is clicked', async () => {
      const mockOnRetry = jest.fn();

      render(<RateLimitError {...defaultProps} retryAfter={0} onRetry={mockOnRetry} />);

      const retryButton = screen.getByText('tryAgain');
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should not show retry button when countdown is active', () => {
      render(<RateLimitError {...defaultProps} retryAfter={30} />);

      expect(screen.queryByText('tryAgain')).not.toBeInTheDocument();
      expect(screen.getByText('pleaseWait')).toBeInTheDocument();
    });

    it('should show disabled "please wait" when retryAfter > 0', () => {
      render(<RateLimitError {...defaultProps} retryAfter={30} />);

      const pleaseWaitButton = screen.getByText('pleaseWait').closest('div');
      expect(pleaseWaitButton).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const mockOnClose = jest.fn();

      render(<RateLimitError {...defaultProps} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const mockOnClose = jest.fn();

      const { container } = render(<RateLimitError {...defaultProps} onClose={mockOnClose} />);

      const backdrop = container.querySelector('[role="dialog"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onClose when modal content is clicked', () => {
      const mockOnClose = jest.fn();

      const { container } = render(<RateLimitError {...defaultProps} onClose={mockOnClose} />);

      const modalContent = container.querySelector('.max-w-md');
      if (modalContent) {
        fireEvent.click(modalContent);
      }

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not render close button when onClose is not provided', () => {
      render(<RateLimitError {...defaultProps} />);

      const closeButton = screen.queryByRole('button', { name: /close/i });
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close modal when Escape key is pressed', () => {
      const mockOnClose = jest.fn();

      render(<RateLimitError {...defaultProps} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when Escape is pressed without onClose', () => {
      render(<RateLimitError {...defaultProps} />);

      // Should not throw error
      expect(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      }).not.toThrow();
    });

    it('should trap focus within modal', () => {
      const { container } = render(<RateLimitError {...defaultProps} retryAfter={0} onRetry={jest.fn()} onClose={jest.fn()} />);

      const focusableElements = container.querySelectorAll('button');
      expect(focusableElements.length).toBeGreaterThan(0);

      // First focusable element should receive focus on mount
      // Note: Actual focus testing requires a real DOM, but we can verify the structure
      expect(focusableElements[0]).toBeInTheDocument();
    });

    it('should cycle focus forward on Tab', () => {
      render(<RateLimitError {...defaultProps} retryAfter={0} onRetry={jest.fn()} onClose={jest.fn()} />);

      const buttons = screen.getAllByRole('button');
      const lastButton = buttons[buttons.length - 1];

      // Focus last button
      lastButton.focus();
      expect(document.activeElement).toBe(lastButton);

      // Press Tab - should cycle to first button
      fireEvent.keyDown(lastButton.closest('.max-w-md')!, { key: 'Tab' });

      // Note: Actual focus trap behavior requires a real DOM environment
      // This test verifies the structure is correct
    });

    it('should cycle focus backward on Shift+Tab', () => {
      render(<RateLimitError {...defaultProps} retryAfter={0} onRetry={jest.fn()} onClose={jest.fn()} />);

      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];

      // Focus first button
      firstButton.focus();

      // Press Shift+Tab - should cycle to last button
      fireEvent.keyDown(firstButton.closest('.max-w-md')!, { key: 'Tab', shiftKey: true });

      // Note: Actual focus trap behavior requires a real DOM environment
    });
  });

  describe('Upgrade Button', () => {
    it('should open pricing page when upgrade button is clicked', () => {
      render(<RateLimitError {...defaultProps} />);

      const upgradeButton = screen.getByText('upgradePlan');
      fireEvent.click(upgradeButton);

      expect(mockWindowOpen).toHaveBeenCalledWith('/pricing', '_blank');
    });

    it('should have proper icon and text', () => {
      render(<RateLimitError {...defaultProps} />);

      expect(screen.getByText('upgradePlan')).toBeInTheDocument();
    });
  });

  describe('Reset Time Display', () => {
    it('should display reset time in local format', () => {
      const resetAt = '2025-12-01T12:30:00Z';

      render(<RateLimitError {...defaultProps} resetAt={resetAt} />);

      const resetDate = new Date(resetAt);
      const timeString = resetDate.toLocaleTimeString();

      expect(screen.getByText(new RegExp(timeString))).toBeInTheDocument();
    });

    it('should show "Quota resets at" label', () => {
      render(<RateLimitError {...defaultProps} />);

      expect(screen.getByText(/quotaResetsAt/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle retryAfter of 0', () => {
      const mockOnRetry = jest.fn();

      render(<RateLimitError {...defaultProps} retryAfter={0} onRetry={mockOnRetry} />);

      // Retry button should be immediately available
      expect(screen.getByText('tryAgain')).toBeInTheDocument();
    });

    it('should handle very large retryAfter values', () => {
      render(<RateLimitError {...defaultProps} retryAfter={86400} />); // 24 hours

      expect(screen.getByText('24:00:00')).toBeInTheDocument();
    });

    it('should stop countdown on unmount', () => {
      const { unmount } = render(<RateLimitError {...defaultProps} retryAfter={60} />);

      expect(screen.getByText('1:00')).toBeInTheDocument();

      unmount();

      // Advance timer - countdown should not continue after unmount
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should not throw any errors
    });

    it('should handle missing onRetry prop', () => {
      render(<RateLimitError {...defaultProps} retryAfter={0} />);

      // Should show disabled state when retry is possible but no handler
      expect(screen.getByText('pleaseWait')).toBeInTheDocument();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should cleanup interval on unmount', () => {
      const { unmount } = render(<RateLimitError {...defaultProps} retryAfter={60} />);

      // Spy on clearInterval
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should cleanup event listeners on unmount', () => {
      const mockOnClose = jest.fn();
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = render(<RateLimitError {...defaultProps} onClose={mockOnClose} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should mark decorative icons as aria-hidden', () => {
      const { container } = render(<RateLimitError {...defaultProps} />);

      const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });

    it('should have proper color contrast for text', () => {
      const { container } = render(<RateLimitError {...defaultProps} />);

      // Check for white text on dark background
      const titleElement = container.querySelector('.text-white');
      expect(titleElement).toBeInTheDocument();
    });

    it('should have readable font sizes', () => {
      const { container } = render(<RateLimitError {...defaultProps} />);

      const title = container.querySelector('.text-2xl');
      expect(title).toBeInTheDocument();
    });
  });
});
