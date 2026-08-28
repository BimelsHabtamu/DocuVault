import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PublicLayout from '../components/PublicLayout';

/* ── Scroll-reveal hook ─────────────────────────── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function FeatureCard({ icon, title, description, accent }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm
      hover:shadow-lg hover:shadow-indigo-100/60 hover:-translate-y-1 hover:border-indigo-200
      transition-all duration-300 p-6 space-y-4 cursor-default">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ num, title, description, active }) {
  return (
    <div className={`flex flex-col items-center text-center gap-3 p-5 rounded-2xl border
      transition-all duration-300 cursor-default
      ${active
        ? 'bg-indigo-50 border-indigo-200 shadow-md shadow-indigo-100/60 -translate-y-1'
        : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/50 hover:-translate-y-0.5'}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black
        shadow-sm transition-all duration-300
        ${active ? 'bg-[#3b5bdb] text-white shadow-indigo-200' : 'bg-[#f0f2fa] text-[#3b5bdb]'}`}>
        {num}
      </div>
      <div>
        <h4 className={`text-sm font-bold ${active ? 'text-[#3b5bdb]' : 'text-[var(--color-text-primary)]'}`}>{title}</h4>
        <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
}

function RoleCard({ role, description, permissions, image }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5 space-y-3
      hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 hover:-translate-y-1
      transition-all duration-300 cursor-default">
      <img src={image} alt="" className="w-10 h-10 rounded-xl object-contain shadow-sm" />
      <div>
        <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{role}</h4>
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{description}</p>
      </div>
      <ul className="space-y-1.5 pt-1">
        {permissions.map(p => (
          <li key={p} className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
            <svg className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatBox({ value, label }) {
  return (
    <div className="text-center space-y-1.5 px-6 py-5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]
      shadow-md shadow-indigo-100/40 hover:shadow-xl hover:shadow-indigo-100/60 hover:-translate-y-1
      transition-all duration-300 cursor-default">
      <p className="text-3xl font-black text-[#3b5bdb]">{value}</p>
      <p className="text-xs text-[var(--color-text-secondary)] font-medium leading-tight">{label}</p>
    </div>
  );
}

const SLIDES = [
  { url: '/image1.png' },
  { url: '/image2.png' },
  { url: '/image3.png' },
  { url: '/image4.png' },
];

export default function LandingPage() {
  const { t } = useTranslation();
  const [activeStep,  setActiveStep]  = useState(0);
  const [slideIndex,  setSlideIndex]  = useState(0);
  const [fadeIn,      setFadeIn]      = useState(true);

  // Scroll-reveal refs
  const refStats    = useReveal();
  const refDepts    = useReveal();
  const refFeatHead = useReveal();
  const refFeats    = useReveal();
  const refHowHead  = useReveal();
  const refSteps    = useReveal();
  const refHowCta   = useReveal();
  const refSecLeft  = useReveal();
  const refSecRight = useReveal();
  const refRolesHead= useReveal();
  const refRoles    = useReveal();
  const refVerifyCta= useReveal();
  const refFinalCta = useReveal();

  const STEPS = [
    { title: t('landing.step1Title'), desc: t('landing.step1Desc') },
    { title: t('landing.step2Title'), desc: t('landing.step2Desc') },
    { title: t('landing.step3Title'), desc: t('landing.step3Desc') },
    { title: t('landing.step4Title'), desc: t('landing.step4Desc') },
    { title: t('landing.step5Title'), desc: t('landing.step5Desc') },
    { title: t('landing.step6Title'), desc: t('landing.step6Desc') },
  ];

  const SLIDE_CAPTIONS = [
    t('landing.slideCaption1'),
    t('landing.slideCaption2'),
    t('landing.slideCaption3'),
    t('landing.slideCaption4'),
  ];

  useEffect(() => {
    const timer = setInterval(() => setActiveStep(s => (s + 1) % 6), 2200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setSlideIndex(i => (i + 1) % SLIDES.length);
        setFadeIn(true);
      }, 600);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PublicLayout>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">

        {/* Slideshow */}
        {SLIDES.map((slide, i) => (
          <div
            key={slide.url}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === slideIndex ? (fadeIn ? 1 : 0) : 0 }}
          >
            <img src={slide.url} alt={SLIDE_CAPTIONS[i]}
              className="w-full h-full object-cover object-center"/>
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-r
          from-[#0f172a]/85 via-[#0f172a]/60 to-[#0f172a]/30"/>

        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}/>

        {/* Slide dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => { setSlideIndex(i); setFadeIn(true); }}
              className={`rounded-full transition-all duration-300 ${
                i === slideIndex ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        {/* Caption */}
        <div className="absolute bottom-8 right-6 hidden sm:block">
          <span className="text-[11px] text-white/50 font-medium tracking-wide">
            {SLIDE_CAPTIONS[slideIndex]}
          </span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 w-full">
          <div className="max-w-2xl space-y-8 hero-animate">

            <div className="space-y-2">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight">
                <span className="text-white block">{t('landing.heroHeadline1')}</span>
                <span className="text-white block">{t('landing.heroHeadline2')}</span>
                <span className="block text-indigo-300">{t('landing.heroHeadline3')}</span>
              </h1>
              <p className="text-lg text-white/70 leading-relaxed max-w-lg pt-2">
                {t('landing.heroSub')}
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {[
                t('landing.pill1'), t('landing.pill2'), t('landing.pill3'),
                t('landing.pill4'), t('landing.pill5'),
              ].map(f => (
                <span key={f}
                  className="inline-flex items-center gap-1.5 text-xs font-medium
                    bg-white/10 backdrop-blur-sm border border-white/20
                    text-white/80 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"/>
                  {f}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/login"
                className="inline-flex items-center justify-center gap-2
                  bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white
                  text-sm font-bold px-8 py-4 rounded-xl
                  shadow-xl shadow-indigo-900/40 transition-all hover:scale-105">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                {t('actions.signInToSystem')}
              </Link>
              <Link to="/verify"
                className="inline-flex items-center justify-center gap-2
                  bg-white/15 hover:bg-white/25 backdrop-blur-sm
                  border border-white/30 text-white
                  text-sm font-bold px-8 py-4 rounded-xl transition-all">
                <svg className="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                {t('actions.verifyDocument')}
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20
          bg-gradient-to-t from-[var(--color-bg)] to-transparent pointer-events-none"/>
      </section>

      {/* ── Stats ─────────────────────────────────────── */}
      <section className="bg-[var(--color-bg)] pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={refStats} className="reveal reveal-stagger grid grid-cols-2 sm:grid-cols-4 gap-4 -mt-6 relative z-10">
            <StatBox value={t('landing.stat1Value')} label={t('landing.stat1Label')} />
            <StatBox value={t('landing.stat2Value')} label={t('landing.stat2Label')} />
            <StatBox value={t('landing.stat3Value')} label={t('landing.stat3Label')} />
            <StatBox value={t('landing.stat4Value')} label={t('landing.stat4Label')} />
          </div>
        </div>
      </section>

      {/* ── Dept tags ─────────────────────────────────── */}
      <section className="bg-[var(--color-surface)] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={refDepts} className="reveal flex flex-wrap justify-center gap-2">
            {[
              t('landing.dept1'), t('landing.dept2'), t('landing.dept3'), t('landing.dept4'),
              t('landing.dept5'), t('landing.dept6'), t('landing.dept7'), t('landing.dept8'),
            ].map(d => (
              <span key={d} className="inline-flex items-center gap-1.5 text-xs font-medium
                bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)]
                px-3.5 py-2 rounded-full hover:border-indigo-200 hover:text-[#3b5bdb] transition-all">
                <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full"/>
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section id="features" className="bg-[var(--color-bg)] py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={refFeatHead} className="reveal text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-xs font-bold text-[#3b5bdb] uppercase tracking-widest
              bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-4">
              {t('landing.featuresBadge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] leading-tight">
              {t('landing.featuresHeadline1')}
              <span className="text-[#3b5bdb]"> {t('landing.featuresHeadline2')}</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] mt-3 text-sm leading-relaxed">
              {t('landing.featuresSub')}
            </p>
          </div>

          <div ref={refFeats} className="reveal reveal-stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard accent="bg-indigo-50"  title={t('landing.feat1Title')} description={t('landing.feat1Desc')}
              icon={<svg className="w-5 h-5 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
            />
            <FeatureCard accent="bg-blue-50"    title={t('landing.feat2Title')} description={t('landing.feat2Desc')}
              icon={<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>}
            />
            <FeatureCard accent="bg-amber-50"   title={t('landing.feat3Title')} description={t('landing.feat3Desc')}
              icon={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>}
            />
            <FeatureCard accent="bg-emerald-50" title={t('landing.feat4Title')} description={t('landing.feat4Desc')}
              icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
            />
            <FeatureCard accent="bg-violet-50"  title={t('landing.feat5Title')} description={t('landing.feat5Desc')}
              icon={<svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
            />
            <FeatureCard accent="bg-rose-50"    title={t('landing.feat6Title')} description={t('landing.feat6Desc')}
              icon={<svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>}
            />
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────── */}
      <section id="how" className="bg-[var(--color-surface)] py-20 lg:py-28 border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={refHowHead} className="reveal text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-xs font-bold text-[#3b5bdb] uppercase tracking-widest
              bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-4">
              {t('landing.howBadge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] leading-tight">
              {t('landing.howHeadline1')}
              <span className="text-[#3b5bdb]"> {t('landing.howHeadline2')}</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] mt-3 text-sm">
              {t('landing.howSub')}
            </p>
          </div>

          <div ref={refSteps} className="reveal reveal-stagger grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {STEPS.map((s, i) => (
              <StepCard key={s.title} num={i + 1} title={s.title}
                description={s.desc} active={activeStep === i} />
            ))}
          </div>

          <div ref={refHowCta} className="reveal mt-12 text-center">
            <Link to="/login"
              className="inline-flex items-center gap-2 bg-[#3b5bdb] hover:bg-[#2f4ac4]
                text-white text-sm font-bold px-8 py-3.5 rounded-xl
                shadow-lg shadow-indigo-200 transition-all hover:scale-105">
              {t('actions.startPlatform')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Security ──────────────────────────────────── */}
      <section id="security" className="bg-[var(--color-bg)] py-20 lg:py-28 border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            <div ref={refSecLeft} className="reveal space-y-6">
              <span className="inline-block text-xs font-bold text-[#3b5bdb] uppercase tracking-widest
                bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                {t('landing.securityBadge')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] leading-tight">
                {t('landing.securityHeadline1')}
                <span className="text-[#3b5bdb]"> {t('landing.securityHeadline2')}</span>
              </h2>
              <p className="text-[var(--color-text-secondary)] text-base leading-relaxed">
                {t('landing.securitySub')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: 'SHA-256', sub: t('landing.secSha') },
                  { title: 'HMAC',    sub: t('landing.secHmac') },
                  { title: 'OTP 2FA', sub: t('landing.secOtp') },
                  { title: 'JWT',     sub: t('landing.secJwt') },
                ].map(({ title, sub }) => (
                  <div key={title} className="bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl p-3.5 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/50
                    hover:-translate-y-0.5 transition-all duration-300 cursor-default">
                    <p className="text-[var(--color-text-primary)] font-bold text-sm">{title}</p>
                    <p className="text-[var(--color-text-secondary)] text-[11px] mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
              <Link to="/verify"
                className="inline-flex items-center gap-2 border border-indigo-200
                  hover:border-indigo-400 hover:bg-indigo-50
                  text-[#3b5bdb] text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                {t('actions.tryVerify')}
              </Link>
            </div>

            {/* Integrity chain */}
            <div ref={refSecRight} className="reveal relative">
              <div className="absolute inset-0 bg-indigo-50/60 blur-3xl rounded-3xl"/>
              <div className="relative bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-md p-6 space-y-3">
                <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
                  {t('landing.secChainTitle')}
                </p>
                {[
                  t('landing.secChain1'), t('landing.secChain2'), t('landing.secChain3'),
                  t('landing.secChain4'), t('landing.secChain5'),
                ].map((label, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[var(--color-bg)]
                    rounded-xl p-3.5 border border-[var(--color-border)]">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-200
                      flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <p className="text-[var(--color-text-secondary)] text-xs leading-snug">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roles ─────────────────────────────────────── */}
      <section id="about" className="bg-[var(--color-surface)] py-20 lg:py-28 border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={refRolesHead} className="reveal text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block text-xs font-bold text-[#3b5bdb] uppercase tracking-widest
              bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full mb-4">
              {t('landing.rolesBadge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] leading-tight">
              {t('landing.rolesHeadline1')}
              <span className="text-[#3b5bdb]"> {t('landing.rolesHeadline2')}</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] mt-3 text-sm">
              {t('landing.rolesSub')}
            </p>
          </div>

          <div ref={refRoles} className="reveal reveal-stagger grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <RoleCard role={t('landing.role1Name')} description={t('landing.role1Desc')} image="/super.png"
              permissions={[t('landing.role1p1'), t('landing.role1p2'), t('landing.role1p3'), t('landing.role1p4')]} />
            <RoleCard role={t('landing.role2Name')} description={t('landing.role2Desc')} image="/system.png"
              permissions={[t('landing.role2p1'), t('landing.role2p2'), t('landing.role2p3'), t('landing.role2p4')]} />
            <RoleCard role={t('landing.role3Name')} description={t('landing.role3Desc')} image="/generator.png"
              permissions={[t('landing.role3p1'), t('landing.role3p2'), t('landing.role3p3'), t('landing.role3p4')]} />
            <RoleCard role={t('landing.role4Name')} description={t('landing.role4Desc')} image="/approver.png"
              permissions={[t('landing.role4p1'), t('landing.role4p2'), t('landing.role4p3'), t('landing.role4p4')]} />
            <RoleCard role={t('landing.role5Name')} description={t('landing.role5Desc')} image="/Recipient.png"
              permissions={[t('landing.role5p1'), t('landing.role5p2'), t('landing.role5p3')]} />
          </div>
        </div>
      </section>

      {/* ── Verify CTA ────────────────────────────────── */}
      <section className="bg-[var(--color-bg)] py-14 border-t border-[var(--color-border)]">
        <div ref={refVerifyCta} className="reveal max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto
            border border-indigo-100">
            <svg className="w-7 h-7 text-[#3b5bdb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">
            {t('landing.ctaHeadline')}
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-xl mx-auto leading-relaxed">
            {t('landing.ctaSub')}
          </p>
          <Link to="/verify"
            className="inline-flex items-center gap-2 bg-[#3b5bdb] hover:bg-[#2f4ac4]
              text-white text-sm font-bold px-7 py-3.5 rounded-xl
              shadow-lg shadow-indigo-200 transition-all hover:scale-105">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            {t('actions.verifyNow')}
          </Link>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('landing.ctaFree')}</p>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────── */}
      <section className="bg-[var(--color-surface)] py-20 border-t border-[var(--color-border)]">
        <div ref={refFinalCta} className="reveal max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-7">
          <img src="/logo.png" alt="DocuVault"
            className="h-16 w-auto object-contain mx-auto drop-shadow-sm" />
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)] leading-tight">
              {t('landing.finalHeadline1')}
              <span className="text-[#3b5bdb]"> {t('landing.finalHeadline2')}</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] text-base max-w-lg mx-auto leading-relaxed">
              {t('landing.finalSub')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login"
              className="inline-flex items-center justify-center gap-2
                bg-[#3b5bdb] hover:bg-[#2f4ac4] text-white
                text-base font-bold px-10 py-4 rounded-xl
                shadow-lg shadow-indigo-200 transition-all hover:scale-105">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
              {t('actions.signInAccount')}
            </Link>
            <Link to="/verify"
              className="inline-flex items-center justify-center gap-2
                bg-[var(--color-bg)] hover:bg-indigo-50 border border-[var(--color-border)]
                hover:border-indigo-200 text-[#3b5bdb]
                text-base font-bold px-10 py-4 rounded-xl transition-all">
              {t('actions.verifyDocument')}
            </Link>
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}
