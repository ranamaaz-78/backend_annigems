import { Icon } from '../../components/ui';

/** Metronic "branded" authentication layout: form card left, branded panel right. */
export default function AuthBox({ title, subtitle, children, wide }) {
    return (
        <div className="grid lg:grid-cols-2 grow min-h-screen bg-background">
            <div className="flex justify-center items-center p-8 lg:p-10 order-2 lg:order-1">
                <div className={`kt-card w-full page-enter ${wide ? 'max-w-[440px]' : 'max-w-[370px]'}`}>
                    <div className="kt-card-content flex flex-col gap-5 p-10">
                        <div className="text-center mb-1">
                            <h3 className="text-lg font-medium text-mono leading-none mb-2.5">{title}</h3>
                            {subtitle && <div className="text-sm text-secondary-foreground">{subtitle}</div>}
                        </div>
                        {children}
                    </div>
                </div>
            </div>
            <div className="lg:rounded-xl lg:border lg:border-border lg:m-5 order-1 lg:order-2 bg-top xl:bg-cover bg-no-repeat branded-bg">
                <div className="flex flex-col p-8 lg:p-16 gap-4">
                    <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 shadow">
                            <img src="/storage/images/logo_aani.png" alt="" className="size-6 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </span>
                        <span className="text-lg font-semibold text-mono tracking-wide">AANI GEMAS</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        <h3 className="text-2xl font-semibold text-mono">Atelier Admin</h3>
                        <div className="text-base font-medium text-secondary-foreground max-w-md">
                            Manage the catalog, Design-Your-Ring, live gold pricing, orders and content of the store,
                            protected by <span className="text-mono font-semibold">mandatory two-factor</span> sign-in.
                        </div>
                    </div>
                    <div className="hidden lg:flex flex-col gap-2.5 mt-4 text-sm text-secondary-foreground">
                        {[['shield-tick', 'TOTP two-factor authentication'], ['chart-line-up', 'Live gold rate & multi-currency pricing'], ['handcart', 'Orders, refunds & fulfilment stages']].map(([i, t]) => (
                            <span key={t} className="flex items-center gap-2"><Icon name={i} className="text-primary" /> {t}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
