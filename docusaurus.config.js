const path = require('path')

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'Buerligons',
  tagline: 'Cad for the web',
  url: 'https://buerligons.io',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.png',
  organizationName: 'awv-informatik', // Usually your GitHub org/user name.
  projectName: 'buerligons', // Usually your repo name.
  themeConfig: {
    footer: {},
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
    },
    prism: {
      theme: require('./src/css/pmndrs'),
    },
    navbar: {
      hideOnScroll: true,
      title: 'Buerligons',
      logo: {
        alt: 'AWV Logo',
        src: 'favicon.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        { href: 'https://x.com/buerli_io', label: 'X', position: 'right' },
        { href: 'https://discord.gg/MEbR7xyPMS', label: 'Discord', position: 'right' },
        {
          href: 'https://github.com/awv-informatik',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: () => undefined,
          //editUrl: (p) => `https://github.com/awv-informatik/buerli/edit/master/doc/content/${p.docPath}`
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        indexPages: true,
        docsRouteBasePath: '/docs',
        hashed: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: false,
        searchResultContextMaxLength: 50,
        searchResultLimits: 8,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
      },
    ],
  ],
  plugins: [
    ['./src/plugins/tailwind-config.js', {}],
    './src/plugins/fixesm.js',    
    [
      'docusaurus-plugin-module-alias',
      {
        alias: {
          react: path.resolve('node_modules/react'),
          'react-dom': path.resolve('node_modules/react-dom'),
          'styled-components': path.resolve('node_modules/styled-components'),
        },
      },
    ],
    [
      'ideal-image',
      /** @type {import('@docusaurus/plugin-ideal-image').PluginOptions} */
      ({
        quality: 70,
        max: 1030,
        min: 640,
        steps: 2,
        // Use false to debug, but it incurs huge perf costs
        disableInDev: true,
      }),
    ],
  ],
}
