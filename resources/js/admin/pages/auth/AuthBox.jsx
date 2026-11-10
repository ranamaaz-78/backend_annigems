import BrandShowcase from './BrandShowcase';

/** Authentication layout: form card left, AANI GEMAS 3D showcase right (on top on small screens). */
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
            <div className="lg:rounded-xl lg:border lg:border-[#3a3222] lg:m-5 order-1 lg:order-2 overflow-hidden lg:min-h-[calc(100vh-2.5rem)]">
                <BrandShowcase />
            </div>
        </div>
    );
}
