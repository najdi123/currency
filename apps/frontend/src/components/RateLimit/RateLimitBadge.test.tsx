import { render, screen } from '@testing-library/react';
import { RateLimitBadge } from './RateLimitBadge';
import { useRateLimit } from '@/hooks/useRateLimit';

// Mock the hook
jest.mock('@/hooks/useRateLimit');
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('RateLimitBadge', () => {
  const mockUseRateLimit = useRateLimit as jest.MockedFunction<typeof useRateLimit>;

  afterEach(() => {
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

      const { container } = render(<RateLimitBadge />);

      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('bg-white/5');
    });

    it('should show loading skeleton when status is null', () => {
      mockUseRateLimit.mockReturnValue({
        status: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitBadge />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Tier Badge', () => {
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

      render(<RateLimitBadge />);

      expect(screen.getByText('FREE')).toBeInTheDocument();
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

      render(<RateLimitBadge />);

      expect(screen.getByText('PREMIUM')).toBeInTheDocument();
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

      render(<RateLimitBadge />);

      expect(screen.getByText('ENTERPRISE')).toBeInTheDocument();
    });
  });

  describe('Color Logic', () => {
    it('should show green when more than 50% remaining', () => {
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

      const { container } = render(<RateLimitBadge />);

      const usageIndicator = container.querySelector('.bg-green-500\\/20');
      expect(usageIndicator).toBeInTheDocument();

      const dot = container.querySelector('.bg-green-400');
      expect(dot).toBeInTheDocument();
    });

    it('should show yellow when 20-50% remaining', () => {
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

      const { container } = render(<RateLimitBadge />);

      const usageIndicator = container.querySelector('.bg-yellow-500\\/20');
      expect(usageIndicator).toBeInTheDocument();

      const dot = container.querySelector('.bg-yellow-400');
      expect(dot).toBeInTheDocument();
    });

    it('should show red when less than 20% remaining', () => {
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

      const { container } = render(<RateLimitBadge />);

      const usageIndicator = container.querySelector('.bg-red-500\\/20');
      expect(usageIndicator).toBeInTheDocument();

      const dot = container.querySelector('.bg-red-400');
      expect(dot).toBeInTheDocument();
    });

    it('should pulse when less than 30% remaining', () => {
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

      const { container } = render(<RateLimitBadge />);

      const dot = container.querySelector('.animate-pulse');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('bg-yellow-400');
    });
  });

  describe('Usage Display', () => {
    it('should display correct usage numbers', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 75,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 75,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitBadge />);

      expect(screen.getByText('75/100')).toBeInTheDocument();
    });

    it('should display zero remaining', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: false,
          remaining: 0,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 0,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitBadge />);

      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('should display large numbers for enterprise tier', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'enterprise',
          allowed: true,
          remaining: 9999,
          limit: 10000,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 99.99,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitBadge />);

      expect(screen.getByText('9999/10000')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
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

      const { container } = render(<RateLimitBadge />);

      const badge = container.querySelector('[role="status"]');
      expect(badge).toBeInTheDocument();
    });

    it('should have aria-live attribute', () => {
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

      const { container } = render(<RateLimitBadge />);

      const badge = container.querySelector('[aria-live="polite"]');
      expect(badge).toBeInTheDocument();
    });

    it('should have descriptive aria-label', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 75,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 75,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<RateLimitBadge />);

      const badge = screen.getByLabelText(/apiUsage.*75.*remaining.*100.*requests/i);
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 50% remaining (boundary)', () => {
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

      const { container } = render(<RateLimitBadge />);

      // Exactly 50% should NOT be green (green is >50%)
      const yellowIndicator = container.querySelector('.bg-yellow-500\\/20');
      expect(yellowIndicator).toBeInTheDocument();
    });

    it('should handle exactly 20% remaining (boundary)', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 20,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 20,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitBadge />);

      // Exactly 20% should NOT be red (red is <20%)
      const yellowIndicator = container.querySelector('[class*="bg-yellow-500/20"]');
      expect(yellowIndicator).toBeInTheDocument();
    });

    it('should handle 100% remaining', () => {
      mockUseRateLimit.mockReturnValue({
        status: {
          tier: 'free',
          allowed: true,
          remaining: 100,
          limit: 100,
          resetAt: '2025-12-01T00:00:00Z',
          percentage: 100,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<RateLimitBadge />);

      const greenIndicator = container.querySelector('.bg-green-500\\/20');
      expect(greenIndicator).toBeInTheDocument();

      expect(screen.getByText('100/100')).toBeInTheDocument();
    });
  });
});
