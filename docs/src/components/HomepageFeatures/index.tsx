import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

type FeatureItem = {
    title: string;
    tone: "amber" | "sky" | "violet" | "emerald" | "rose" | "indigo";
    icon: ReactNode;
    description: string;
    to: string;
    cta: string;
};

const ZapIcon = () => (
    <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const MoveIcon = () => (
    <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v20" />
        <path d="m15 5-3-3-3 3" />
        <path d="m15 19-3 3-3-3" />
        <path d="M2 12h20" />
        <path d="m5 9-3 3 3 3" />
        <path d="m19 9 3 3-3 3" />
    </svg>
);

const LayersIcon = () => (
    <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

const BlocksIcon = () => (
    <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
);

const FileCodeIcon = () => (
    <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="m10 13-2 2 2 2" />
        <path d="m14 17 2-2-2-2" />
    </svg>
);

const ScanIcon = () => (
    <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 9v6" />
        <path d="M9 12h6" />
    </svg>
);

const features: FeatureItem[] = [
    {
        title: "Quick starts",
        tone: "amber",
        icon: <ZapIcon />,
        description: "Install the right packages and get a first rendered grid running in vanilla TypeScript or React.",
        to: "/docs/introduction/getting_started",
        cta: "Open guide",
    },
    {
        title: "Camera & events",
        tone: "sky",
        icon: <MoveIcon />,
        description: "Use pan, zoom, hover, click, drag, and snapped world coordinates without rebuilding camera math.",
        to: "/docs/js/events",
        cta: "Read events",
    },
    {
        title: "Drawing & layers",
        tone: "violet",
        icon: <LayersIcon />,
        description: "Compose grids, rects, circles, images, text, paths, sprites, and overlays with predictable layer order.",
        to: "/docs/js/drawing_and_layers",
        cta: "View API",
    },
    {
        title: "Renderer choices",
        tone: "emerald",
        icon: <BlocksIcon />,
        description: "Keep engine logic portable across Canvas2D, WebGL, React Native Skia, and headless server output.",
        to: "/docs/introduction/renderers",
        cta: "Compare renderers",
    },
    {
        title: "React bindings",
        tone: "rose",
        icon: <FileCodeIcon />,
        description: "Mount the engine declaratively, keep large item arrays stable, and wire draw components into app state.",
        to: "/docs/react/installation",
        cta: "Use React",
    },
    {
        title: "Performance paths",
        tone: "indigo",
        icon: <ScanIcon />,
        description: "Apply viewport culling, spatial indexing, static caches, and renderer batching for large tile scenes.",
        to: "/docs/introduction/performance",
        cta: "Tune scenes",
    },
];

function Feature({ title, tone, icon, description, to, cta }: FeatureItem) {
    return (
        <Link className={`${styles.featureCard} ${styles[tone]}`} to={to}>
            <span className={styles.featureTopLine} aria-hidden />
            <span className={styles.featureGrid} aria-hidden />
            <span className={styles.featureIcon}>{icon}</span>
            <h3 className={styles.featureTitle}>{title}</h3>
            <p className={styles.featureDescription}>{description}</p>
            <span className={styles.featureCta}>
                {cta}
                <svg aria-hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12L10 8L6 4" />
                </svg>
            </span>
        </Link>
    );
}

export default function HomepageFeatures(): ReactNode {
    return (
        <section className={styles.features}>
            <div className={styles.featureContainer}>
                <div className={styles.sectionHeader}>
                    <p className={styles.sectionEyebrow}>Documentation paths</p>
                    <h2 className={styles.sectionTitle}>Find the part of the engine you need</h2>
                    <p className={styles.sectionDescription}>
                        Start with the core model, then jump into renderer-specific guides, React bindings, event handling,
                        or performance notes when your surface gets bigger.
                    </p>
                </div>
                <div className={styles.cardGrid}>
                    {features.map((feature) => (
                        <Feature key={feature.title} {...feature} />
                    ))}
                </div>
            </div>
        </section>
    );
}
