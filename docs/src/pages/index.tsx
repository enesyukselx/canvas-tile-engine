import { useEffect, type ReactNode } from "react";
import Head from "@docusaurus/Head";

const HOME_URL = "https://www.canvastileengine.com/";

/**
 * The docs site has no homepage of its own: / redirects to the marketing
 * site. The meta refresh covers the statically generated HTML (no JS);
 * the effect makes the client-side redirect instant.
 */
export default function Home(): ReactNode {
    useEffect(() => {
        window.location.replace(HOME_URL);
    }, []);

    return (
        <>
            <Head>
                <title>Canvas Tile Engine</title>
                <meta httpEquiv="refresh" content={`0; url=${HOME_URL}`} />
                <link rel="canonical" href={HOME_URL} />
                <meta name="robots" content="noindex" />
            </Head>
            <main style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
                <p>
                    Redirecting to <a href={HOME_URL}>canvastileengine.com</a>…
                </p>
            </main>
        </>
    );
}
