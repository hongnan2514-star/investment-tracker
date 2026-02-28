"use client";

import dynamic from 'next/dynamic';

const AssetDetailPage = dynamic(
  () => import('./AssetDetailPageContent'),
  { ssr: false }
);

export default AssetDetailPage;