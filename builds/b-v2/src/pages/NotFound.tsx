import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui';

export function NotFound({
  title = 'Page not found',
  message = 'The page you’re looking for doesn’t exist or has moved.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center animate-rise">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-brand-soft text-brand-ink">
        <Compass className="size-8" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-muted">{message}</p>
      <ButtonLink to="/" className="mt-8">
        Back to browsing
      </ButtonLink>
    </div>
  );
}
