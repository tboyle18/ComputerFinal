import { passwordStrength } from '../lib/validation';
import { cx } from './ui';

export function PasswordMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return <p className="text-xs text-muted">At least 10 characters, with letters and numbers. Longer is stronger.</p>;
  const color = score <= 1 ? 'bg-danger' : score === 2 ? 'bg-warning' : 'bg-success';
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= score ? color : 'bg-line')} />
        ))}
      </div>
      <span className="w-16 text-right text-xs font-medium text-muted">{label}</span>
    </div>
  );
}
