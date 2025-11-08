import { forwardRef } from 'react';
import { FiCheck, FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
  animate?: boolean;
}

const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ');
};

const variantConfig = {
  success: {
    containerClass: 'bg-success-bg border-success-text/20',
    iconClass: 'text-success-text',
    textClass: 'text-success-text',
    defaultIcon: FiCheck,
  },
  error: {
    containerClass: 'bg-error-bg border-error-text/20',
    iconClass: 'text-error-text',
    textClass: 'text-error-text',
    defaultIcon: FiAlertCircle,
  },
  warning: {
    containerClass: 'bg-warning-bg border-warning-text/20',
    iconClass: 'text-warning-text',
    textClass: 'text-warning-text',
    defaultIcon: FiAlertTriangle,
  },
  info: {
    containerClass: 'bg-info-bg border-info-text/20',
    iconClass: 'text-info-text',
    textClass: 'text-info-text',
    defaultIcon: FiInfo,
  },
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, icon, children, className, animate = true, ...props }, ref) => {
    const config = variantConfig[variant];
    const Icon = icon || config.defaultIcon;

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border',
          config.containerClass,
          animate ? 'animate-slide-down-fade' : undefined,
          className
        )}
        role="alert"
        
        {...props}
      >
        <div className={cn('flex-shrink-0 mt-0.5', config.iconClass)}>
          {typeof Icon === 'function' ? <Icon className="w-5 h-5" /> : Icon}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h5 className={cn('text-sm font-semibold mb-1', config.textClass)}>
              {title}
            </h5>
          )}
          <div className={cn('text-sm', config.textClass)}>
            {children}
          </div>
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
