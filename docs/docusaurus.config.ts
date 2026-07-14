import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
    title: "Canvas Tile Engine",
    tagline: "Renderer-agnostic 2D tile engine for maps, editors, games, and grid UIs",
    favicon: "img/favicon.ico",

    // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
    future: {
        v4: true, // Improve compatibility with the upcoming Docusaurus v4
    },

    // Set the production url of your site here
    url: "https://www.canvastileengine.dev/",
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: "/",

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: "enesyukselx", // Usually your GitHub org/user name.
    projectName: "canvas-tile-engine", // Usually your repo name.

    onBrokenLinks: "throw",

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },

    presets: [
        [
            "classic",
            {
                docs: {
                    sidebarPath: "./sidebars.ts",
                    // Please change this to your repo.
                    // Remove this to remove the "edit this page" links.
                    editUrl:
                        "https://github.com/enesyukselx/canvas-tile-engine/tree/master/docs/",
                },
                /*blog: {
                    showReadingTime: true,
                    feedOptions: {
                        type: ["rss", "atom"],
                        xslt: true,
                    },
                    // Please change this to your repo.
                    // Remove this to remove the "edit this page" links.
                    editUrl:
                        "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
                    // Useful options to enforce blogging best practices
                    onInlineTags: "warn",
                    onInlineAuthors: "warn",
                    onUntruncatedBlogPosts: "warn",
                },*/
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        // Replace with your project's social card
        image: "img/docusaurus-social-card.jpg",
        colorMode: {
            respectPrefersColorScheme: true,
        },
        navbar: {
            // The brand wordmark is a swizzled component (src/theme/Navbar/Logo)
            // that mirrors the landing site and links to canvastileengine.com.
            items: [
                {
                    href: "https://www.canvastileengine.com/api-docs",
                    label: "API",
                    position: "left",
                    target: "_self",
                },
                {
                    href: "https://www.canvastileengine.com/playground",
                    label: "Playground",
                    position: "left",
                    target: "_self",
                },
                {
                    href: "https://www.canvastileengine.com/examples",
                    label: "Examples",
                    position: "left",
                    target: "_self",
                },
                {
                    type: "docSidebar",
                    sidebarId: "tutorialSidebar",
                    position: "left",
                    label: "Docs",
                },
                { type: "docsVersionDropdown", position: "right" },
                {
                    href: "https://github.com/enesyukselx/canvas-tile-engine",
                    position: "right",
                    className: "header-icon-link header-github-link",
                    "aria-label": "GitHub repository",
                    target: "_self",
                },
                {
                    href: "https://www.npmjs.com/package/@canvas-tile-engine/core",
                    position: "right",
                    className: "header-icon-link header-npm-link",
                    "aria-label": "npm package",
                    target: "_self",
                },
            ],
        },
        footer: {
            style: "dark",
            links: [
                {
                    title: "Documentation",
                    items: [
                        {
                            label: "Getting Started",
                            to: "/docs/introduction/getting_started",
                        },
                        {
                            label: "Configuration",
                            to: "/docs/introduction/config",
                        },
                    ],
                },
                {
                    title: "Resources",
                    items: [
                        {
                            label: "GitHub",
                            href: "https://github.com/enesyukselx/canvas-tile-engine",
                        },
                        {
                            label: "npm",
                            href: "https://www.npmjs.com/package/@canvas-tile-engine/core",
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Canvas Tile Engine, Inc. Built with Docusaurus.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
