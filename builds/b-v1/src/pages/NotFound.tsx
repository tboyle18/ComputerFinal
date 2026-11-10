import { ArrowLeft } from 'lucide-react'
import { PageContainer } from '../components/layout/Layout'
import { ButtonLink } from '../components/ui/Button'

export default function NotFound() {
  return (
    <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-[120px] leading-none text-ink/10 italic sm:text-[180px]">404</p>
      <h1 className="-mt-6 text-3xl font-semibold tracking-tight sm:-mt-10">This page wandered off</h1>
      <p className="mt-3 max-w-sm text-muted">Maybe someone bought it. Either way, there’s plenty more to discover.</p>
      <ButtonLink to="/" className="mt-8" size="lg">
        <ArrowLeft /> Back to the marketplace
      </ButtonLink>
    </PageContainer>
  )
}
