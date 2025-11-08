import { forwardRef, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
  label?: string;
  hint?: string;
  showPasswordToggle?: boolean;
}

const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ');
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      error,
      icon,
      label,
      hint,
      showPasswordToggle,
      className,
      type,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
    const inputType = showPasswordToggle && showPassword ? 'text' : type;

    return (
      <div className="space-y-2" >
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-text-primary"
          >
            {label}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Leading Icon (Right side in RTL) */}
          {icon && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <div className="text-text-tertiary">{icon}</div>
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={cn(
              // Base styles
              'block w-full px-4 py-3.5',
              icon ? 'pr-11' : undefined,
              showPasswordToggle ? 'pl-11' : undefined,
              // Typography
              'text-base leading-tight',
              'placeholder:text-text-tertiary',
              // Border and background
              'border rounded-lg bg-bg-base',
              error
                ? 'border-error-text focus:ring-error-text'
                : 'border-border-light focus:ring-accent',
              // Focus state
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'transition-all duration-200 ease-out',
              // Disabled state
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-secondary',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />

          {/* Password Toggle (Left side in RTL) */}
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-tertiary hover:text-text-primary transition-colors focus:outline-none"
              aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
              tabIndex={-1}
            >
              {showPassword ? (
                <FiEyeOff className="w-5 h-5" />
              ) : (
                <FiEye className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Hint or Error */}
        {(hint || error) && (
          <p
            id={error ? `${inputId}-error` : `${inputId}-hint`}
            className={cn(
              'text-sm',
              error ? 'text-error-text' : 'text-text-tertiary'
            )}
            role={error ? 'alert' : undefined}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
