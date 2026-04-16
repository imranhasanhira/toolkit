import { Link as WaspRouterLink, routes } from 'wasp/client/router';
import { Button } from '../client/components/ui/button';

const heroImageUrl = '/landing-hero-dawn.png';

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      {/* Hero — full viewport, background image, layered overlay */}
      <section
        className="relative min-h-[100vh] flex flex-col items-center justify-center px-6 py-24 sm:py-32"
        style={{
          backgroundImage: `url(${heroImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark gradient overlay for text contrast */}
        <div
          className="absolute inset-0 z-0"
          aria-hidden
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.6) 100%)',
          }}
        />
        {/* Subtle vignette */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden
          style={{
            boxShadow: 'inset 0 0 20vmin rgba(0,0,0,0.25)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h1
            className="text-white text-4xl font-bold tracking-tight drop-shadow-lg sm:text-5xl md:text-7xl md:leading-tight"
            style={{
              animation: 'landing-reveal 1s ease-out both',
              animationDelay: '0.15s',
              animationFillMode: 'both',
            }}
          >
            <span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(120deg, #fef3c7 0%, #fde68a 25%, #fcd34d 50%, #fbbf24 75%, #f59e0b 100%)',
                backgroundSize: '200% auto',
                animation: 'landing-shimmer 8s linear infinite',
              }}
            >
              Build with intention.
            </span>
          </h1>
          <p
            className="mt-6 max-w-2xl mx-auto text-lg leading-relaxed text-white/95 drop-shadow-md sm:text-xl"
            style={{
              animation: 'landing-reveal 0.9s ease-out both',
              animationDelay: '0.5s',
              animationFillMode: 'both',
            }}
          >
            Every tool exists to help you go further. Think clearly, create
            bravely, move forward—one step at a time.
          </p>
          <div
            className="mt-12 flex flex-wrap items-center justify-center gap-4"
            style={{
              animation: 'landing-reveal 0.8s ease-out both',
              animationDelay: '0.85s',
              animationFillMode: 'both',
            }}
          >
            <Button
              size="lg"
              className="bg-amber-500/95 text-black hover:bg-amber-400 shadow-xl shadow-amber-900/30 border-0 font-semibold"
              asChild
            >
              <WaspRouterLink to={routes.SignupRoute.to}>
                Get started
              </WaspRouterLink>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/50 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:border-white/70"
              asChild
            >
              <WaspRouterLink to={routes.LoginRoute.to}>
                Sign in
              </WaspRouterLink>
            </Button>
          </div>
        </div>

        {/* Floating accent — subtle motion */}
        <div
          className="absolute bottom-12 left-1/2 z-10 text-white/40"
          style={{
            animation: 'landing-float 4s ease-in-out infinite',
          }}
          aria-hidden
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
      </section>

      {/* Pillars — cards with hover lift and staggered reveal */}
      <section className="relative border-t border-border/60 bg-gradient-to-b from-muted/50 to-background px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <h2
            className="text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{
              animation: 'landing-reveal 0.8s ease-out both',
              animationDelay: '0.2s',
              animationFillMode: 'both',
            }}
          >
            What we stand for
          </h2>
          <div className="mt-16 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {[
              {
                label: 'Clarity',
                body: 'See what matters. Strip away the noise and focus on the work that moves you.',
                delay: '0.35s',
              },
              {
                label: 'Craft',
                body: 'Use the right tools for the job. Build habits and workflows that last.',
                delay: '0.5s',
              },
              {
                label: 'Possibility',
                body: 'Tomorrow is unwritten. What you do today shapes the path ahead.',
                delay: '0.65s',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="group relative rounded-2xl border border-border/60 bg-card/80 p-8 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/5 dark:hover:shadow-primary/10"
                style={{
                  animation: 'landing-pillar-in 0.7s ease-out both',
                  animationDelay: item.delay,
                  animationFillMode: 'both',
                }}
              >
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.08), transparent 70%)',
                  }}
                  aria-hidden
                />
                <p className="text-muted-foreground relative text-sm font-medium uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="text-foreground relative mt-3 text-base leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing line — emphasis */}
      <section className="relative px-6 py-24 sm:py-28">
        <div
          className="mx-auto max-w-3xl text-center"
          style={{
            animation: 'landing-glow 6s ease-in-out infinite',
          }}
        >
          <p className="text-foreground text-xl font-medium italic sm:text-2xl">
            The best time to start was yesterday.
          </p>
          <p className="text-primary mt-2 text-2xl font-semibold sm:text-3xl">
            The next best is now.
          </p>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-muted-foreground text-center text-sm">
            Toolkit — tools for the journey.
          </p>
        </div>
      </footer>
    </div>
  );
}
