// app/portfolio/page.tsx
"use client";

import dynamic from 'next/dynamic';

const PortfolioPage = dynamic(
  () => import('./PortfolioPageContent'),
  { ssr: false }
);

export default PortfolioPage;