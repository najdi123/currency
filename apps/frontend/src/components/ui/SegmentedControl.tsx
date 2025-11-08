import { forwardRef } from 'react';

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedControlOption[];
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ');
};

const sizeClasses = {
  sm: 'py-1.5 px-2.5 text-xs',
  md: 'py-2.5 px-3 text-sm',
  lg: 'py-3 px-4 text-base',
};

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ value, onChange, options, size = 'md', fullWidth = false, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex p-1 gap-1',
          'bg-bg-base rounded-lg border border-border-light',
          fullWidth ? 'w-full' : undefined,
          className
        )}
        role="radiogroup"
        
      >
        {options.map((option) => {
          const isSelected = value === option.value;
          const isDisabled = option.disabled;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !isDisabled && onChange(option.value)}
              disabled={isDisabled}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-md',
                'font-medium transition-all duration-200 ease-out',
                sizeClasses[size],
                // Selected state - elevated pill (Apple style)
                isSelected ? 'bg-bg-elevated shadow-sm text-text-primary ring-1 ring-border-light' : undefined,
                // Unselected state
                !isSelected ? 'text-text-secondary hover:bg-bg-secondary/50 active:scale-95' : undefined,
                // Disabled state
                isDisabled ? 'opacity-40 cursor-not-allowed' : undefined
              )}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isDisabled}
              aria-label={option.label}
            >
              {option.icon && (
                <span
                  className={cn(
                    'transition-colors duration-200',
                    isSelected ? 'text-accent' : 'text-text-tertiary'
                  )}
                  aria-hidden="true"
                >
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
);

SegmentedControl.displayName = 'SegmentedControl';
