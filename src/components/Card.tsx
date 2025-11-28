import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`
        bg-primary-800/50 backdrop-blur-sm border border-primary-700/50 
        rounded-2xl p-6 shadow-xl shadow-primary-900/50 overflow-hidden
        ${hover ? 'card-hover cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  colorClass?: string;
}

export function StatCard({ icon, label, value, suffix, colorClass = 'text-accent-400' }: StatCardProps) {
  return (
    <Card hover className="flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-primary-700/50 ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-primary-400 text-sm font-medium">{label}</p>
        <p className="text-2xl font-display font-bold text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-lg text-primary-400 ml-1">{suffix}</span>}
        </p>
      </div>
    </Card>
  );
}

export default Card;

