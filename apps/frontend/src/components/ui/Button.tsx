import React from 'react'

/**
 * Button variant types inspired by Apple's Human Interface Guidelines
 */
export type ButtonVariant = 'filled' | 'tinted' | 'gray' | 'plain'

/**
 * Button size options
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant
   * - filled: Primary action with solid blue background
   * - tinted: Secondary action with light blue background
   * - gray: Tertiary action with gray background
   * - plain: Text-only button with no background
   */
  variant?: ButtonVariant

  /**
   * Button size
   * - sm: Compact size for tight spaces
   * - md: Default size for most use cases
   * - lg: Large size for prominent actions
   */
  size?: ButtonSize

  /**
   * Button content
   */
  children: React.ReactNode

  /**
   * Whether the button should take full width of its container
   */
  fullWidth?: boolean
}

/**
 * Button - A reusable button component with Apple-inspired design
 *
 * Design Philosophy:
 * - Clean, minimal aesthetic inspired by Apple's iOS and macOS buttons
 * - Single accent color system (SF Blue)
 * - Smooth transitions and subtle hover effects
 * - Clear visual hierarchy through variants
 * - Generous padding and touch targets
 * - Accessibility-first with proper focus states
 * - Uses ONLY Tailwind CSS classes (no inline styles)
 *
 * Variants:
 * - filled: High emphasis - use for primary actions (blue background, white text)
 * - tinted: Medium emphasis - use for secondary actions (light blue bg, blue text)
 * - gray: Low emphasis - use for tertiary actions (gray bg, dark text)
 * - plain: Minimal emphasis - use for inline actions (no bg, blue text)
 *
 * Accessibility:
 * - Proper focus rings with 3px blur and accent color
 * - Keyboard navigation support
 * - Disabled state with reduced opacity
 * - Touch-optimized with proper target sizes
 * - Screen reader compatible
 *
 * @example
 * ```tsx
 * <Button variant="filled" size="md" onClick={handleClick}>
 *   Primary Action
 * </Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'filled',
      size = 'md',
      children,
      fullWidth = false,
      className = '',
      disabled = false,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base classes that apply to all buttons
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-[0.375rem] border-none transition-all duration-200 touch-manipulation [-webkit-tap-highlight-color:transparent]'

    // Size-specific classes
    const sizeClasses = {
      sm: 'text-sm px-3 py-1.5 min-h-[32px]',
      md: 'text-base px-4 py-2 min-h-[40px]',
      lg: 'text-lg px-6 py-3 min-h-[48px]',
    }

    // Variant-specific classes
    const variantClasses = {
      filled: 'bg-accent text-white hover:bg-accent-hover disabled:bg-accent disabled:opacity-40',
      tinted: 'bg-blue-100 dark:bg-blue-900/30 text-accent hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-40',
      gray: 'bg-gray-200 dark:bg-gray-700 text-text-primary hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40',
      plain: 'bg-transparent text-accent hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 disabled:opacity-40',
    }

    // Width classes
    const widthClass = fullWidth ? 'w-full' : ''

    // Cursor classes
    const cursorClass = disabled ? 'cursor-not-allowed' : 'cursor-pointer'

    // Active state and focus classes
    const interactionClasses = disabled
      ? ''
      : 'active:scale-[0.97] focus:outline-none focus:ring-[3px] focus:ring-[rgba(var(--accent-primary),0.4)] focus:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100'

    // Combine all classes
    const combinedClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${cursorClass} ${interactionClasses} ${className}`.trim()

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={combinedClasses}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
