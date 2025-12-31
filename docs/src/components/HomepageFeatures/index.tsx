import type { ReactNode } from "react";
import styles from "./styles.module.css";

type FeatureItem = {
    title: string;
    icon: ReactNode;
    description: ReactNode;
};

// Lucide-style icons
const ZapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
);

const MousePointerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        <path d="m13 13 6 6"/>
    </svg>
);

const LayersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
    </svg>
);

const FeatureList: FeatureItem[] = [
    {
        title: "High Performance",
        icon: <ZapIcon />,
        description: (
            <>
                Built on HTML5 Canvas to handle thousands of objects with smooth rendering.
                Optimized for large grid-based maps and games.
            </>
        ),
    },
    {
        title: "Rich Interactions",
        icon: <MousePointerIcon />,
        description: (
            <>
                Out-of-the-box support for zooming, panning, dragging, and complex mouse events.
                Coordinate transformations are handled automatically.
            </>
        ),
    },
    {
        title: "Layered Architecture",
        icon: <LayersIcon />,
        description: (
            <>
                Organize your map with multiple layers. Draw shapes, images, and text easily
                with a simple and intuitive API.
            </>
        ),
    },
];

function Feature({ title, icon, description }: FeatureItem) {
    return (
        <div className={styles.featureCard}>
            <div className={styles.featureIcon}>{icon}</div>
            <h3 className={styles.featureTitle}>{title}</h3>
            <p className={styles.featureDescription}>{description}</p>
        </div>
    );
}

export default function HomepageFeatures(): ReactNode {
    return (
        <section className={styles.features}>
            <div className={styles.featureContainer}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Why Canvas Tile Engine?</h2>
                    <p className={styles.sectionDescription}>
                        Everything you need to build interactive 2D grid-based visualizations
                    </p>
                </div>
                <div className={styles.featureGrid}>
                    {FeatureList.map((props, idx) => (
                        <Feature key={idx} {...props} />
                    ))}
                </div>
            </div>
        </section>
    );
}
