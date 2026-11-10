import { useEffect, useRef } from 'react';
import { Icon } from '../../components/ui';
import '../../../../css/admin/auth-showcase.css';

// Coloured gems orbiting the diamond, 120° apart, on a tilted plane: rotateX(72°)·rotateZ(-14°), radius 255px.
const ORBIT = ['ruby', 'sapphire', 'emerald'];
const ORBIT_R = 255;
const ORBIT_MS = 18000;
const TILT_X = (72 * Math.PI) / 180;
const TILT_Z = (-14 * Math.PI) / 180;

/** Point of the tilted orbit at angle φ (same maths as CSS rotateX(72deg) rotateZ(-14deg) on (R cosφ, R sinφ, 0)). */
function orbitPoint(phi) {
    const x0 = ORBIT_R * Math.cos(phi);
    const y0 = ORBIT_R * Math.sin(phi);
    const x1 = x0 * Math.cos(TILT_Z) - y0 * Math.sin(TILT_Z);
    const y1 = x0 * Math.sin(TILT_Z) + y0 * Math.cos(TILT_Z);
    return { x: x1, y: y1 * Math.cos(TILT_X) + 6, z: y1 * Math.sin(TILT_X) };
}

/** One linear keyframe loop per gem (transform only → runs on the GPU compositor). */
function orbitKeyframes(phase) {
    return Array.from({ length: 73 }, (_, i) => {
        const p = orbitPoint(phase + (i / 72) * Math.PI * 2);
        return { transform: `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, ${p.z.toFixed(1)}px)` };
    });
}

/**
 * Branded panel of the sign-in screens: a CSS 3D atelier scene (no libraries).
 * - Brilliant-cut diamond built from real facets (8 crown + 8 pavilion faces + table), slowly turning.
 * - A gold band around it, and ruby, sapphire and emerald orbiting it on a tilted plane. The orbit is one
 *   precomputed translate3d loop per gem (Web Animations API), so the gems stay upright with no nested rotations.
 * - Only transform/opacity animate (GPU compositor, no repaints). The pointer tilt is eased in one
 *   requestAnimationFrame loop that writes transforms directly and stops once it has settled.
 * - Everything stops for prefers-reduced-motion.
 */
export default function BrandShowcase() {
    const ref = useRef(null);
    const sceneRef = useRef(null);
    const decoRef = useRef(null);
    const motion = useRef({ tx: 0, ty: 0, x: 0, y: 0, raf: 0 });
    const orbitRefs = useRef([]);

    // Orbit: start each gem 120° apart; reduced motion leaves them parked at their start point.
    useEffect(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const anims = orbitRefs.current.map((el, i) => {
            if (!el) return null;
            const frames = orbitKeyframes((i * 2 * Math.PI) / ORBIT.length);
            if (reduce || !el.animate) {
                el.style.transform = frames[0].transform;
                return null;
            }
            return el.animate(frames, { duration: ORBIT_MS, iterations: Infinity, easing: 'linear' });
        });
        return () => anims.forEach((a) => a?.cancel());
    }, []);

    useEffect(() => {
        const m = motion.current;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const apply = () => {
            if (sceneRef.current) sceneRef.current.style.transform = `rotateX(${(-m.y * 10).toFixed(2)}deg) rotateY(${(m.x * 14).toFixed(2)}deg)`;
            if (decoRef.current) decoRef.current.style.translate = `${(-m.x * 10).toFixed(1)}px ${(-m.y * 10).toFixed(1)}px`;
        };
        const tick = () => {
            // ease toward the pointer (frame-rate friendly exponential smoothing)
            m.x += (m.tx - m.x) * 0.08;
            m.y += (m.ty - m.y) * 0.08;
            apply();
            m.raf = Math.abs(m.tx - m.x) + Math.abs(m.ty - m.y) > 0.0005 ? requestAnimationFrame(tick) : 0;
        };
        m.start = () => { if (!reduce && !m.raf) m.raf = requestAnimationFrame(tick); };
        apply();
        return () => cancelAnimationFrame(m.raf);
    }, []);

    const onMove = (e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const m = motion.current;
        m.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
        m.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
        m.start?.();
    };
    const onLeave = () => {
        const m = motion.current;
        m.tx = 0;
        m.ty = 0;
        m.start?.();
    };

    return (
        <div ref={ref} className="ag-showcase" onPointerMove={onMove} onPointerLeave={onLeave}>
            <div className="ag-bg" aria-hidden="true">
                <svg ref={decoRef} className="ag-deco" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
                    <defs>
                        <linearGradient id="agLine" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#f5e4a8" stopOpacity=".0" />
                            <stop offset=".5" stopColor="#c9a84c" stopOpacity=".55" />
                            <stop offset="1" stopColor="#7a5c14" stopOpacity=".0" />
                        </linearGradient>
                    </defs>
                    {[120, 170, 220, 270].map((r) => <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="url(#agLine)" strokeWidth=".6" />)}
                    {Array.from({ length: 24 }, (_, i) => {
                        const a = (i * Math.PI) / 12;
                        return <line key={i} x1={300 + Math.cos(a) * 280} y1={300 + Math.sin(a) * 280} x2={300 + Math.cos(a) * 420} y2={300 + Math.sin(a) * 420} stroke="url(#agLine)" strokeWidth=".5" />;
                    })}
                </svg>
            </div>

            <div className="ag-stage" aria-hidden="true">
                <div className="ag-glow" />
                <div ref={sceneRef} className="ag-scene">
                    <div className="ag-orbit">
                        <div className="ag-band">
                            {Array.from({ length: 6 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
                        </div>
                    </div>
                    <div className="ag-hero"><Gem /></div>
                    <div className="ag-gem-orbit"><span className="ag-orbit-path" /></div>
                    {ORBIT.map((tone, i) => (
                        <div key={tone} ref={(el) => { orbitRefs.current[i] = el; }} className="ag-orbiter"><Gem tone={tone} sides={6} /></div>
                    ))}
                </div>
                {SPARKS.map(([x, y, s, d], i) => (
                    <svg key={i} className="ag-spark" viewBox="0 0 24 24" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${d}s` }}>
                        <path d="M12 0 C13 9 15 11 24 12 C15 13 13 15 12 24 C11 15 9 13 0 12 C9 11 11 9 12 0Z" />
                    </svg>
                ))}
            </div>

            <div className="ag-copy">
                <div className="flex items-center gap-2.5">
                    <span className="ag-logo">
                        <img src="/storage/images/logo_aani.png" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </span>
                    <span className="ag-brand">AANI GEMAS</span>
                </div>
                <div className="ag-copy-bottom">
                    <span className="ag-eyebrow">Fine jewellery · Atelier</span>
                    <h2 className="ag-title">Where every gem<br /><em>finds its setting.</em></h2>
                    <p className="ag-text">
                        The atelier console for the catalogue, Design Your Ring, live gold pricing, retail &amp; B2B orders,
                        sales persons and commission.
                    </p>
                    <div className="ag-chips">
                        {[['shield-tick', 'Two-factor sign-in'], ['chart-line-up', 'Live gold rate'], ['shop', 'B2B & commissions']].map(([i, t]) => (
                            <span key={t} className="ag-chip"><Icon name={i} /> {t}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// [left %, top %, size px, delay s]
const SPARKS = [[18, 22, 14, 0], [78, 18, 10, 1.2], [70, 64, 16, 0.6], [26, 70, 9, 2.1], [86, 42, 12, 1.7], [12, 46, 8, 2.8], [55, 12, 9, 0.9], [44, 80, 11, 2.4]];

const N = 8;

// One solid colour per facet (no gradients/clip-path: those force GPU mask layers and made the scene lag).
const hsla = (h, s, l, a) => `hsla(${h} ${s}% ${l}% / ${a})`;
const coloured = (h, s, pav, crown) => ({ pav: pav.map((l) => hsla(h, s, l, 0.88)), crown: crown.map((l) => hsla(h, s, l, 0.9)), table: hsla(h, s, 78, 0.85) });
const PALETTES = {
    // diamond: icy facets with a little "fire" (pink, mint, champagne)
    diamond: {
        pav: ['rgba(255,255,255,.92)', 'rgba(150,182,228,.72)', 'rgba(255,198,230,.66)', 'rgba(78,102,150,.7)', 'rgba(236,246,255,.86)', 'rgba(190,255,236,.62)', 'rgba(112,142,196,.72)', 'rgba(255,238,196,.72)'],
        crown: ['rgba(255,255,255,.9)', 'rgba(214,232,255,.8)', 'rgba(255,240,206,.82)', 'rgba(170,198,238,.78)', 'rgba(255,255,255,.88)', 'rgba(224,214,255,.78)', 'rgba(196,220,250,.8)', 'rgba(240,250,255,.86)'],
        table: 'rgba(245,250,255,.82)',
    },
    ruby: coloured(342, 82, [64, 40, 26, 50, 70, 33, 46, 22], [78, 58, 66, 48, 82, 55, 62, 50]),
    sapphire: coloured(222, 80, [66, 42, 24, 52, 72, 32, 46, 20], [80, 60, 68, 50, 84, 56, 64, 52]),
    emerald: coloured(154, 72, [62, 38, 22, 48, 68, 30, 44, 20], [76, 56, 64, 46, 80, 52, 60, 48]),
};

/**
 * Brilliant-cut gem: pavilion triangles + crown trapezoids (CSS border shapes) + table, all real 3D planes.
 * 8 sides for the hero diamond; the small floating gems use 6 (fewer GPU layers, same look at that size).
 */
function Gem({ tone = 'diamond', sides = N }) {
    const p = PALETTES[tone];
    const step = 360 / sides;
    return (
        <div className={`ag-gem ag-${tone} ag-n${sides}`}>
            <div className="ag-gem-spin">
                {Array.from({ length: sides }, (_, i) => <span key={`p${i}`} className="ag-pav" style={{ '--a': `${i * step}deg`, '--c': p.pav[i] }} />)}
                {Array.from({ length: sides }, (_, i) => <span key={`c${i}`} className="ag-crown" style={{ '--a': `${i * step}deg`, '--c': p.crown[i] }} />)}
                <span className="ag-table" style={{ '--c': p.table }} />
            </div>
        </div>
    );
}
