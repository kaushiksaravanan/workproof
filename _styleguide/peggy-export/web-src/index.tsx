import { createFileRoute } from "@tanstack/react-router";
import momDoodle from "@/assets/peggy-mom-doodle.png";
import familyDoodle from "@/assets/peggy-family-doodle.png";
import paperPlane from "@/assets/peggy-paper-plane.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Peggy Style Guide" },
      { name: "description", content: "Visual style guide extracted from the Peggy app — colors, type, components, and motion for an Android build." },
      { property: "og:title", content: "Peggy Style Guide" },
      { property: "og:description", content: "Colors, typography, and components for the Peggy-inspired Android app." },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500;1,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: StyleGuide,
});

type Swatch = {
  name: string;
  token: string;
  hex: string;
  varName: string;
  ink?: boolean;
};

const colorGroups: { title: string; swatches: Swatch[] }[] = [
  {
    title: "Brand",
    swatches: [
      { name: "Peggy Blue", token: "bg-peggy-blue", hex: "#7DA1FF", varName: "--peggy-blue" },
      { name: "Lavender Tint", token: "bg-peggy-lavender", hex: "#CAD9F6", varName: "--peggy-lavender", ink: true },
      { name: "Deep Ink", token: "bg-peggy-ink", hex: "#001A33", varName: "--peggy-ink" },
      { name: "Surface", token: "bg-card", hex: "#FFFFFF", varName: "--card", ink: true },
    ],
  },
  {
    title: "Accents",
    swatches: [
      { name: "Sunshine", token: "bg-peggy-yellow", hex: "#FFD84D", varName: "--peggy-yellow", ink: true },
      { name: "Coral", token: "bg-peggy-coral", hex: "#F0445B", varName: "--peggy-coral" },
      { name: "Mint", token: "bg-peggy-mint", hex: "#C9EFC3", varName: "--peggy-mint", ink: true },
      { name: "Amber", token: "bg-peggy-amber", hex: "#BD814B", varName: "--peggy-amber" },
    ],
  },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StyleGuide() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Hero — paper-plane flock + mom doodle peeking, mirrors the reference */}
      <header className="relative overflow-hidden bg-peggy-blue" aria-label="Peggy style guide hero">
        <div className="absolute -left-10 top-12 h-40 w-40 rounded-full bg-peggy-lavender/40 blur-3xl" aria-hidden />
        <div className="absolute right-0 top-10 h-56 w-56 rounded-full bg-peggy-yellow/30 blur-3xl" aria-hidden />

        {/* Paper-plane flock — small on mobile (top-right corner), larger and spread on desktop */}
        <img src={paperPlane} alt="" role="presentation" width={160} height={160} loading="eager" className="pointer-events-none absolute right-3 top-3 h-16 w-16 rotate-[8deg] opacity-90 sm:right-8 sm:top-8 sm:h-28 sm:w-28" />
        <img src={paperPlane} alt="" role="presentation" width={120} height={120} loading="eager" className="pointer-events-none absolute right-24 top-14 hidden h-16 w-16 -rotate-[18deg] opacity-70 md:block" />
        <img src={paperPlane} alt="" role="presentation" width={96} height={96} loading="eager" className="pointer-events-none absolute bottom-6 right-10 hidden h-14 w-14 rotate-[24deg] opacity-60 lg:block" />

        <div className="relative mx-auto grid max-w-5xl gap-8 px-6 pb-20 pt-16 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-peggy-ink">Style Guide</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-peggy-ink sm:text-6xl">
              <span className="marker-underline">Peggy</span> design system
              <span className="block font-italic-serif text-peggy-ink/85">for an Android app</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-peggy-ink/80 sm:text-lg">
              Warm, playful, trustworthy. A family-first visual language with handwritten energy, soft cards, and a confident cornflower blue.
            </p>

            <nav aria-label="Style guide sections" className="mt-8 flex flex-wrap gap-3">
              <a href="#colors" className="rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-peggy-ink shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">Colors</a>
              <a href="#type" className="rounded-full bg-peggy-ink px-5 py-2.5 text-sm font-semibold text-card transition hover:-translate-y-0.5 hover:bg-peggy-ink/90">Typography</a>
              <a href="#components" className="rounded-full border-2 border-peggy-ink/80 bg-transparent px-5 py-2.5 text-sm font-semibold text-peggy-ink transition hover:-translate-y-0.5 hover:bg-peggy-ink hover:text-card">Components</a>
              <a href="#illustrations" className="rounded-full bg-peggy-yellow px-5 py-2.5 text-sm font-semibold text-peggy-ink transition hover:-translate-y-0.5 hover:brightness-105">Illustrations</a>
            </nav>
          </div>

          {/* Mom doodle peeking from bottom-right on desktop only */}
          <img
            src={momDoodle}
            alt="Peggy mascot: a smiling parent with curly hair and round glasses, drawn in a single navy ink line"
            width={240}
            height={280}
            loading="eager"
            className="pointer-events-none hidden h-56 w-auto self-end justify-self-end lg:block xl:h-64"
          />
        </div>
      </header>


      <main className="mx-auto max-w-5xl space-y-20 px-6 py-20">
        {/* Personality */}
        <Section id="personality" eyebrow="01 · Brand" title={<>A voice that feels like a <span className="marker-underline">friend</span></>}>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { t: "Warm", d: "Made by a parent, for parents. Generous, never corporate." },
              { t: "Playful", d: "Hand-drawn accents, paper planes, marker underlines." },
              { t: "Clean", d: "Crisp cards and clear hierarchy do the heavy lifting." },
            ].map((c) => (
              <article key={c.t} tabIndex={0} className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[0_16px_36px_oklch(0.2_0.08_268/0.14)] focus-visible:-translate-y-1">
                <h3 className="text-2xl font-extrabold">{c.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
              </article>
            ))}
          </div>
        </Section>

        {/* Colors */}
        <Section id="colors" eyebrow="02 · Color" title={<>Palette</>}>
          <div className="space-y-8">
            {colorGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {group.swatches.map((s) => (
                    <div key={s.name} className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-soft)] ring-1 ring-border">
                      <div className={`${s.token} flex h-28 items-end p-4`}>
                        <span className={`font-display text-xl font-bold ${s.ink ? "text-peggy-ink" : "text-white"}`}>{s.name}</span>
                      </div>
                      <div className="space-y-1 px-4 py-3 text-xs">
                        <p className="font-mono text-foreground">{s.hex}</p>
                        <p className="font-mono text-muted-foreground">{s.varName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section id="type" eyebrow="03 · Type" title={<>Plus Jakarta Sans + <span className="font-italic-serif">Fraunces</span></>}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-card p-8 shadow-[var(--shadow-card)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Display · Plus Jakarta Sans ExtraBold</p>
              <p className="mt-3 text-5xl font-extrabold leading-tight tracking-tight">
                <span className="marker-underline">Start</span> your<br/>
                <span className="font-italic-serif">day with a digest</span>
              </p>
              <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                <p>Display · 34sp / 800 · line 38</p>
                <p>H1 · 28sp / 800 — H2 · 22sp / 700</p>
                <p>Italic emphasis · Fraunces 500 italic</p>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-8 shadow-[var(--shadow-card)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Body · Plus Jakarta Sans</p>
              <p className="mt-4 text-lg font-semibold text-foreground">Title · 17sp / 600</p>
              <p className="mt-2 text-[15px] text-foreground">
                Body — 15sp / 400. The quick brown fox jumps over the lazy dog while parents sip coffee and the kids finally agree on what to eat.
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Caption · 12 / 600 · +0.6 tracking</p>
            </div>
          </div>

          <div className="rounded-2xl bg-peggy-lavender p-6 text-peggy-ink">
            <p className="text-sm font-semibold">Headline treatment</p>
            <p className="mt-2 text-sm">Mix <strong>extra-bold sans</strong> with <em className="font-italic-serif">italic serif</em> emphasis in one headline. Apply the yellow marker underline to a single key word — never two.</p>
          </div>
        </Section>

        {/* Components */}
        <Section id="components" eyebrow="04 · UI" title="Components">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Buttons — all foreground colors pass WCAG AA */}
            <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-xl font-extrabold">Buttons</h3>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="rounded-2xl bg-peggy-blue px-5 py-3 text-sm font-bold text-peggy-ink shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] active:translate-y-0">Primary action</button>
                <button className="rounded-2xl border-2 border-peggy-ink bg-card px-5 py-3 text-sm font-bold text-peggy-ink transition hover:-translate-y-0.5 hover:bg-peggy-ink hover:text-card">Secondary</button>
                <button className="rounded-full bg-peggy-amber px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-peggy-ink transition hover:-translate-y-0.5 hover:brightness-110">Buy tickets</button>
                <button className="rounded-full bg-peggy-coral px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-peggy-ink transition hover:-translate-y-0.5 hover:brightness-110">New</button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">All buttons render a 3px ink focus ring on keyboard focus.</p>
            </div>

            {/* Chips */}
            <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-xl font-extrabold">Tabs &amp; Chips</h3>
              <div className="mt-5 inline-flex rounded-full bg-peggy-lavender p-1">
                <button className="rounded-full bg-card px-4 py-1.5 text-sm font-semibold text-peggy-ink shadow-[var(--shadow-soft)]">Academic</button>
                <button className="px-4 py-1.5 text-sm font-semibold text-peggy-ink/80 transition hover:text-peggy-ink">Extracurricular</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-peggy-mint px-3 py-1 text-xs font-semibold text-peggy-ink">Piano · 1pm</span>
                <span className="rounded-full bg-peggy-lavender px-3 py-1 text-xs font-semibold text-peggy-ink">Tennis · 3pm</span>
                <span className="rounded-full bg-peggy-yellow px-3 py-1 text-xs font-semibold text-peggy-ink">Field trip</span>
              </div>
            </div>

            {/* Event card */}
            <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-2">
              <h3 className="text-xl font-extrabold">Event card</h3>
              <div className="mt-5 rounded-2xl bg-peggy-lavender p-5">
                <article tabIndex={0} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)] focus-visible:-translate-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-peggy-lavender px-3 py-1 text-xs font-semibold text-peggy-ink">📘 Extracurricular</span>
                  <h4 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">Willow Creek&apos;s Champs Summer Sports Bash</h4>
                  <p className="mt-2 text-sm text-muted-foreground">A fun-filled event for boys and girls at Crestwood Primary. Both adult and child tickets required.</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">🗓 Tue, Apr 5pm – 6pm</div>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">📍 Berner Middle School · Birch St.</div>
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-xl bg-muted px-3 py-3">
                    <div>
                      <p className="text-sm font-semibold">Buy tickets</p>
                      <p className="text-xs text-muted-foreground">Adult &amp; child ticket required.</p>
                    </div>
                    <button className="rounded-full bg-peggy-blue px-4 py-2 text-xs font-extrabold text-peggy-ink transition hover:-translate-y-0.5 hover:brightness-105">Buy tickets ›</button>
                  </div>
                </article>
              </div>
            </div>

            {/* Reminder list */}
            <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-2">
              <h3 className="text-xl font-extrabold">Today&apos;s reminders</h3>
              <ul className="mt-4 divide-y divide-border">
                {[
                  { t: "Pack lunch for field trip", s: "5th grade camping trip", done: true },
                  { t: "Prepare swim kit", s: "Swimming lessons", done: false },
                  { t: "RSVP to Mila&apos;s party", s: "Reply by Friday", done: false },
                ].map((r) => (
                  <li key={r.t} className="flex items-center gap-3 py-3">
                    <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-md border-2 ${r.done ? "border-peggy-ink bg-peggy-ink text-card" : "border-peggy-ink/40 bg-card"}`}>
                      {r.done && <span className="text-[10px] font-bold">✓</span>}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${r.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{r.t}</p>
                      <p className="text-xs text-muted-foreground">{r.s}</p>
                    </div>
                    <div aria-hidden className="h-7 w-7 rounded-full bg-peggy-lavender ring-2 ring-card" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Illustrations */}
        <Section id="illustrations" eyebrow="05 · Illustration" title={<>Hand-drawn <span className="font-italic-serif">doodles</span></>}>
          <p className="max-w-2xl text-base text-muted-foreground">
            Loose, single-line ink sketches in <span className="font-mono text-foreground">--peggy-ink</span>. Used sparingly to add warmth — never as decorative filler. Pair with notebook-paper backgrounds and paper-plane flourishes.
          </p>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Notebook paper card */}
            <article className="relative overflow-hidden rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-2"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, transparent 0, transparent 31px, oklch(0.74 0.13 268 / 0.18) 31px, oklch(0.74 0.13 268 / 0.18) 32px), linear-gradient(to right, transparent 0, transparent 39px, oklch(0.66 0.22 18 / 0.35) 39px, oklch(0.66 0.22 18 / 0.35) 40px, transparent 40px)",
                backgroundSize: "100% 32px, 100% 100%",
              }}>
              <img src={paperPlane} alt="" role="presentation" width={96} height={96} loading="lazy" className="pointer-events-none absolute right-6 top-4 h-20 w-20 rotate-[12deg] opacity-80" />
              <img src={paperPlane} alt="" role="presentation" width={64} height={64} loading="lazy" className="pointer-events-none absolute bottom-8 right-12 h-12 w-12 -rotate-[20deg] opacity-60" />
              <div className="relative flex flex-col items-start gap-4 pl-10 sm:flex-row sm:items-end">

                <img src={momDoodle} alt="Single-line ink doodle of a smiling parent with curly hair and round glasses, used as the Peggy mascot" width={240} height={280} loading="lazy" className="h-40 w-auto sm:h-44" />
                <div className="pb-2">
                  <p className="text-3xl font-extrabold leading-tight tracking-tight">
                    Let <span className="marker-underline">Peggy</span><br/>
                    <span className="font-italic-serif">filter school</span> stuff
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    emails · RSVPs · forms · deadlines
                  </p>
                </div>
              </div>
            </article>

            {/* Family doodle card */}
            <article className="rounded-2xl bg-peggy-blue p-6 text-peggy-ink shadow-[var(--shadow-card)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-peggy-ink/70">Portrait</p>
              <h3 className="mt-1 text-2xl font-extrabold leading-tight">
                Made with <span className="font-italic-serif">love</span>
              </h3>
              <div className="mt-4 rounded-xl bg-card p-3">
                <img src={familyDoodle} alt="Hand-drawn family portrait: a dad with glasses and three children standing arm-in-arm, labeled 'The 3 Musketeers'" width={448} height={384} loading="lazy" className="mx-auto h-40 w-auto" />
                <p className="mt-2 text-center font-italic-serif text-sm text-peggy-ink">The 3 Musketeers</p>
              </div>
              <p className="mt-3 text-xs text-peggy-ink/80">Family portraits sit inside a white card with a soft scalloped feel.</p>
            </article>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { t: "Single-line ink", d: "One continuous navy stroke. No fills, no shading." },
              { t: "Notebook paper", d: "Blue rule lines + red margin. Always behind doodles." },
              { t: "Paper planes", d: "Tiny, rotated, with a dashed trail. Used as accents." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)]">
                <h3 className="text-base font-extrabold">{c.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>

          {/* Do / Don't usage rules */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Usage — do &amp; don&apos;t</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  good: true,
                  title: "Anchor doodles to a corner",
                  body: "Mom mascot peeks from a bottom or right corner against blue or notebook paper. Leaves at least 24dp clear space around the figure.",
                },
                {
                  good: false,
                  title: "Don&apos;t center a doodle in body copy",
                  body: "Doodles aren&apos;t inline illustrations. Never wrap text around them or float them mid-paragraph.",
                },
                {
                  good: true,
                  title: "Paper planes as 12–32dp accents",
                  body: "Use 1–3 planes per surface, rotated between -25° and +25°, with 60–90% opacity. Always pointing into the layout, never off-screen.",
                },
                {
                  good: false,
                  title: "Don&apos;t swarm or scale planes huge",
                  body: "More than 3 planes feels like clip-art. Above 48dp they read as content, not accent — keep them whisper-small.",
                },
                {
                  good: true,
                  title: "Family portraits live in a white card",
                  body: "Place inside a rounded white card on a colored surface. Caption in Fraunces italic, sized 14sp.",
                },
                {
                  good: false,
                  title: "Don&apos;t recolor the ink",
                  body: "Doodles are always --peggy-ink on white or lavender. Never tint to brand accents (coral, yellow, mint) — it breaks the hand-drawn voice.",
                },
              ].map((r) => (
                <div
                  key={r.title}
                  className={`rounded-2xl p-5 ring-1 ${r.good ? "bg-peggy-mint/40 ring-peggy-ink/10" : "bg-peggy-coral/15 ring-peggy-coral/30"}`}
                >
                  <p className={`text-xs font-extrabold uppercase tracking-wider ${r.good ? "text-peggy-ink" : "text-peggy-coral"}`}>
                    <span aria-hidden>{r.good ? "✓ " : "✗ "}</span>
                    {r.good ? "Do" : "Don&apos;t"}
                  </p>
                  <h4 className="mt-2 text-base font-extrabold text-foreground">{r.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spacing & sizing spec */}
          <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-soft)]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Placement &amp; sizing spec</h3>
            <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Mom mascot (hero)", "h 224–256dp · bottom-right · 32dp clear space"],
                ["Mom mascot (card)", "h 160–176dp · left-aligned beside headline"],
                ["Family portrait", "h 160dp · centered in white card with 12dp inset"],
                ["Paper plane accent", "16–32dp · rotate −25° to +25° · 60–90% opacity"],
                ["Min. margin from edge", "16dp mobile · 24dp tablet · 32dp desktop"],
                ["Max. planes per surface", "3 (any more reads as clip-art)"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                  <dt className="font-semibold text-foreground">{k}</dt>
                  <dd className="text-right font-mono text-xs text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        {/* Spacing */}
        <Section id="spacing" eyebrow="06 · Layout" title="Spacing & radius">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-xl font-extrabold">Spacing scale (dp)</h3>
              <div className="mt-4 space-y-2">
                {[4, 8, 12, 16, 24, 32].map((n) => (
                  <div key={n} className="flex items-center gap-3 text-sm">
                    <span className="w-8 font-mono text-muted-foreground">{n}</span>
                    <span aria-hidden className="block h-3 rounded-full bg-peggy-blue" style={{ width: `${n * 4}px` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-xl font-extrabold">Radius</h3>
              <div className="mt-4 flex flex-wrap gap-4">
                {[
                  { n: "12", c: "rounded-xl" },
                  { n: "20", c: "rounded-2xl" },
                  { n: "28", c: "rounded-3xl" },
                ].map((r) => (
                  <div key={r.n} className="text-center">
                    <div aria-hidden className={`h-20 w-20 ${r.c} bg-peggy-lavender ring-2 ring-peggy-ink/15`} />
                    <p className="mt-2 font-mono text-xs text-muted-foreground">{r.n}dp</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Motion */}
        <Section id="motion" eyebrow="07 · Motion" title="Feel">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { t: "Spring", d: "stiffness 220 · damping 26. Used on cards, sheets, chips." },
              { t: "Marker draw", d: "Yellow underline draws in over 250ms on enter." },
              { t: "Paper plane", d: "Success states swoosh diagonally with a soft trail." },
              { t: "Press lift", d: "Interactive cards rise 4dp on tap, settle on release." },
            ].map((m) => (
              <div key={m.t} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-extrabold">{m.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.d}</p>
              </div>
            ))}
          </div>
        </Section>
      </main>

      <footer className="border-t border-border bg-peggy-ink py-10 text-center text-sm text-card/80">
        <p className="font-italic-serif">Made with love · Peggy style guide v1</p>
      </footer>
    </div>
  );
}
