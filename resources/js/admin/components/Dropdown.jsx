import { useEffect, useRef, useState } from 'react';

/**
 * KTUI dropdown menu driven by React state (click to toggle, click outside / Escape to close).
 * placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
 */
export default function Dropdown({ toggle, children, placement = 'bottom-end', width = 'w-56', className = '' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const pos = {
        'bottom-start': 'top-full start-0 mt-2',
        'bottom-end': 'top-full end-0 mt-2',
        'top-start': 'bottom-full start-0 mb-2',
        'top-end': 'bottom-full end-0 mb-2',
    }[placement];

    return (
        <div ref={ref} className={`relative inline-flex ${className}`}>
            <div onClick={() => setOpen((o) => !o)} className="contents">{typeof toggle === 'function' ? toggle(open) : toggle}</div>
            {open && (
                <div className={`kt-dropdown-menu open kt-dropdown-anim absolute z-50 ${pos} ${width}`} onClick={(e) => e.target.closest('a,button[data-close]') && setOpen(false)}>
                    {typeof children === 'function' ? children(() => setOpen(false)) : children}
                </div>
            )}
        </div>
    );
}
