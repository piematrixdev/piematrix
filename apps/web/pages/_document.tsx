import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Display font for admin / titles — Jost */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        
        {/* SEO Meta Tags */}
        <meta name="description" content="SkyWatch - Real-time interactive star map and astronomy companion. Explore stars, planets, constellations, and deep sky objects from your location." />
        <meta name="keywords" content="astronomy, star map, night sky, constellations, planets, stargazing, celestial objects, sky watching, telescope, deep sky objects, Messier catalog" />
        <meta name="author" content="Sky Guild" />
        <meta name="robots" content="index, follow" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://watch.skyguild.club/" />
        <meta property="og:title" content="SkyWatch - Real-time Interactive Star Map" />
        <meta property="og:description" content="Explore the night sky in real-time. View stars, planets, constellations, and deep sky objects from your location." />
        <meta property="og:image" content="https://watch.skyguild.club/SkyGuild_Logo.png" />
        <meta property="og:site_name" content="SkyWatch by Sky Guild" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://watch.skyguild.club/" />
        <meta name="twitter:title" content="SkyWatch - Real-time Interactive Star Map" />
        <meta name="twitter:description" content="Explore the night sky in real-time. View stars, planets, constellations, and deep sky objects from your location." />
        <meta name="twitter:image" content="https://watch.skyguild.club/SkyGuild_Logo.png" />
        
        {/* Theme */}
        <meta name="theme-color" content="#0a0a1a" />
        <meta name="msapplication-TileColor" content="#0a0a1a" />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://watch.skyguild.club/" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
