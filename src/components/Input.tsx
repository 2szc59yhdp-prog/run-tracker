import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-2 w-full overflow-hidden">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-primary-200"
      >
        {label}
      </label>
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full max-w-full px-4 py-3 bg-primary-800/50 border border-primary-700 
            rounded-xl text-white placeholder-primary-500
            outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-accent-500
            transition-all duration-200 min-h-[48px] box-border
            [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert
            [&::-webkit-date-and-time-value]:text-left
            ${icon ? 'pl-12' : ''}
            ${error ? 'border-danger-500 focus:ring-danger-500' : ''}
            ${className}
          `}
          style={{ WebkitAppearance: 'none', MozAppearance: 'none', outline: 'none' }}
          {...props}
        />
      </div>
      {error && (
        <p className="text-danger-500 text-sm font-medium">{error}</p>
      )}
    </div>
  );
}

export default Input;

