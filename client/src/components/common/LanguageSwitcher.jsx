import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../i18n';

function starPoints(cx, cy, outer, inner, rotationDeg) {
  const pts = [];
  const rot = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function UsaFlag() {
  const stripes = [];
  for (let i = 0; i < 13; i++) {
    stripes.push(<rect key={i} x="0" y={i * 2} width="52" height="2" fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'} />);
  }
  const stars = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 10; c++) {
      stars.push(
        <polygon
          key={`${r}-${c}`}
          points={starPoints(1.04 + c * 2.08, 1.4 + r * 2.8, 0.62, 0.25, 0)}
          fill="#FFFFFF"
        />
      );
    }
  }
  return (
    <svg viewBox="0 0 52 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {stripes}
      <rect x="0" y="0" width="20.8" height="14" fill="#3C3B6E" />
      {stars}
    </svg>
  );
}

function EthiopiaFlag() {
  return (
    <svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="0" width="30" height="6.67" fill="#078930" />
      <rect x="0" y="6.67" width="30" height="6.67" fill="#FCDD09" />
      <rect x="0" y="13.33" width="30" height="6.67" fill="#DA121A" />
      <circle cx="15" cy="10" r="5.1" fill="#0F47AF" />
      <polygon points={starPoints(15, 10, 3.3, 1.35, 0)} fill="#FCDD09" />
    </svg>
  );
}

/**
 * LanguageSwitcher — two variants:
 *   'navbar'  : compact flag button used in the top Navbar
 *   'compact' : small select dropdown (legacy, kept for backward-compat)
 *   'menu'    : toggle button used in sidebar/menus
 */
export default function LanguageSwitcher({ variant = 'navbar' }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language === 'am' ? 'am' : 'en';

  const toggle = () => setAppLanguage(current === 'en' ? 'am' : 'en');

  const Flag = current === 'en' ? UsaFlag : EthiopiaFlag;

  /* ── Navbar variant: flag button ── */
  if (variant === 'navbar') {
    return (
      <button
        type="button"
        className="lang-switcher-navbar"
        onClick={toggle}
        title={t('language.switch', { lang: current === 'en' ? 'አማርኛ' : 'English' })}
        aria-label={t('language.switchLabel')}
      >
        <span className="lang-flag" aria-hidden="true">
          <Flag />
        </span>
        <span className="lang-code">
          {current === 'en' ? 'EN' : 'AM'}
        </span>
      </button>
    );
  }

  /* ── Menu variant: toggle button with flag ── */
  if (variant === 'menu') {
    return (
      <button
        type="button"
        className="lang-switcher-btn"
        onClick={toggle}
        title={t('language.switch', { lang: current === 'en' ? 'አማርኛ' : 'English' })}
        aria-label={t('language.switchLabel')}
      >
        <span className="lang-switcher-flag" aria-hidden="true">
          <Flag />
        </span>
        <span className="lang-switcher-label">
          {current === 'en' ? 'አማርኛ' : 'English'}
        </span>
      </button>
    );
  }

  /* ── Compact variant: select dropdown (legacy) ── */
  return (
    <select
      className={`lang-select lang-select-${variant}`}
      value={current}
      onChange={(e) => setAppLanguage(e.target.value)}
      aria-label={t('language.switchLabel')}
    >
      <option value="en">English</option>
      <option value="am">አማርኛ</option>
    </select>
  );
}