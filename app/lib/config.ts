export const config = {
  metadata: {
    siteName: "CherryJS App",
    siteDescription: "Built with CherryJS Framework",
    siteUrl: "",
    logo: "/logo.svg",
    ogImage: "/og.png",
    favicon: "/favicon.ico",
    lang: "en",
    author: "",
    twitterHandle: "",
    keywords: [] as string[],
  },

  features: {
    payments: false,
    onboarding: false,
    waitlist: false,
  },

  payments: {
    trackInConvex: true,
  },
} as const;
