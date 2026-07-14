import type { ReactNode } from "react";
import Link from "@docusaurus/Link";

const HOME_URL = "https://www.canvastileengine.com/";

/**
 * Landing-parity brand wordmark ("Canvas [Tile] Engine" with the pulsing
 * amber tile). Replaces the default image+title logo and always points at
 * the marketing site, not the docs root.
 */
export default function NavbarLogo(): ReactNode {
    return (
        <Link to={HOME_URL} target="_self" className="navbar__brand ctym-brand" aria-label="Canvas Tile Engine home">
            Canvas
            <span className="ctym-tile">
                <span aria-hidden className="ctym-tile-frame" />
                <span aria-hidden className="ctym-dot ctym-dot--tl" />
                <span aria-hidden className="ctym-dot ctym-dot--tr" />
                <span aria-hidden className="ctym-dot ctym-dot--bl" />
                <span aria-hidden className="ctym-dot ctym-dot--br" />
                <span className="ctym-tile-text">Tile</span>
            </span>
            Engine
        </Link>
    );
}
