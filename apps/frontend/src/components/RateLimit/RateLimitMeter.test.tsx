import { render, screen, fireEvent } from '@testing-library/react';
import { RateLimitMeter } from './RateLimitMeter';
import { useRateLimit } from '@/hooks/useRateLimit';

// Mock the hook
jest.mock('@/hooks/useRateLimit');
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock window.open
const mockWindowOpen = jest.fn();
global.window.open = mockWindowOpen;

describe('RateLimitMeter', () => {
  const mockUseRateLimit = useRateLimit as jest.MockedFunction<typeof useRateLimit>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton when loading', () => {
      mockUseRateLimit.mockReturnValue({
        status: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitMeter />);

      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('bg-white/5');
    });
  });

  describe('Error State', () => {
    it('should show error message when error occurs', () => {
      mockUseRateLimit.mockReturnValue({
        status: null,
        loading: false,
        error: 'Network error',
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText('errorLoading')).toBeInTheDocument();
    });

    it('should show error when status is null and not loading', () => {
      mockUseRateLimit.mockReturnValue({
        status: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText('errorLoading')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should display correct usage percentage', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 25,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 25,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      // Used = 75, so percentage = 75%
      expect(screen.getByText(/75.*\/.*100/)).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should have correct ARIA attributes on progress bar', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 30,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 30,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitMeter />);

      const progressbar = container.querySelector('[role="progressbar"]');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '70'); // 70% used
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should show green bar when usage < 50%', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 60,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 60,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitMeter />);

      const progressFill = container.querySelector('.bg-gradient-to-r.from-green-500');
      expect(progressFill).toBeInTheDocument();
    });

    it('should show yellow bar when usage 50-80%', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 35,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 35,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitMeter />);

      // Used = 65%, should be yellow
      const progressFill = container.querySelector('.bg-gradient-to-r.from-yellow-500');
      expect(progressFill).toBeInTheDocument();
    });

    it('should show red bar when usage > 80%', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 10,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 10,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitMeter />);

      // Used = 90%, should be red
      const progressFill = container.querySelector('.bg-gradient-to-r.from-red-500');
      expect(progressFill).toBeInTheDocument();
    });
  });

  describe('Tier Display', () => {
    it('should display FREE tier badge', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 50,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 50,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText(/Free.*plan/i)).toBeInTheDocument();
    });

    it('should display PREMIUM tier badge', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'premium',
          allowed: true,
          remaining: 500,
          limit: 1000,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 50,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText(/Premium.*plan/i)).toBeInTheDocument();
    });

    it('should display ENTERPRISE tier badge', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'enterprise',
          allowed: true,
          remaining: 9000,
          limit: 10000,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 90,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText(/Enterprise.*plan/i)).toBeInTheDocument();
    });
  });

  describe('Upgrade CTA', () => {
    it('should show upgrade CTA for free tier when usage > 70%', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 25,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 25,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      // Used = 75%, should show upgrade CTA
      expect(screen.getByText('nearLimitWarning')).toBeInTheDocument();
      expect(screen.getByText('upgradeForMore')).toBeInTheDocument();
      expect(screen.getByText('upgradePlan')).toBeInTheDocument();
    });

    it('should NOT show upgrade CTA when usage <= 70%', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 35,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 35,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      // Used = 65%, should NOT show upgrade CTA
      expect(screen.queryByText('nearLimitWarning')).not.toBeInTheDocument();
    });

    it('should NOT show upgrade CTA for premium tier', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'premium',
          allowed: true,
          remaining: 100,
          limit: 1000,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 10,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      // Used = 90%, but premium tier, should NOT show upgrade CTA
      expect(screen.queryByText('nearLimitWarning')).not.toBeInTheDocument();
    });

    it('should open pricing page when upgrade button clicked', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 25,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 25,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      const upgradeButtons = screen.getAllByText('upgradePlan');
      fireEvent.click(upgradeButtons[0]);

      expect(mockWindowOpen).toHaveBeenCalledWith('/pricing', '_blank');
    });
  });

  describe('Critical Warning', () => {
    it('should show critical warning when usage > 90%', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 5,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 5,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      // Used = 95%, should show critical warning
      expect(screen.getByText('criticalWarning')).toBeInTheDocument();
      expect(screen.getByText('criticalMessage')).toBeInTheDocument();
    });

    it('should NOT show critical warning when usage <= 90%', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 15,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 15,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      // Used = 85%, should NOT show critical warning
      expect(screen.queryByText('criticalWarning')).not.toBeInTheDocument();
    });

    it('should show both upgrade CTA and critical warning when applicable', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 5,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 5,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      // Used = 95%, both should show
      expect(screen.getByText('nearLimitWarning')).toBeInTheDocument();
      expect(screen.getByText('criticalWarning')).toBeInTheDocument();
    });
  });

  describe('Reset Time Display', () => {
    it('should show remaining time in days', () => {
      const resetAt = new Date(Date.now() + 30 * 60 * 60 * 1000); // 30 hours from now

      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 50,
          limit: 100,
          resetAt: resetAt.toISOString(),
          percentage: 50,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText(/resetsIn.*days?/i)).toBeInTheDocument();
    });

    it('should show remaining time in hours', () => {
      const resetAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now

      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 50,
          limit: 100,
          resetAt: resetAt.toISOString(),
          percentage: 50,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText(/resetsIn.*hours?/i)).toBeInTheDocument();
    });

    it('should show "less than hour" for < 1 hour remaining', () => {
      const resetAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 50,
          limit: 100,
          resetAt: resetAt.toISOString(),
          percentage: 50,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText(/resetsIn.*lessThanHour/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading for screen readers', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 50,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 50,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitMeter />);

      expect(screen.getByText('apiUsage')).toBeInTheDocument();
    });

    it('should mark decorative icons as aria-hidden', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 25,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 25,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitMeter />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
