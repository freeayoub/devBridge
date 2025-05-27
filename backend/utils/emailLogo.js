/**
 * Logo for email templates
 * Using the actual app logo
 */

// Base64 encoded SVG logo for the app
exports.getLogoSvg = () => {
  // This is a more detailed version of the app logo as an SVG
  const svgLogo = `
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">
    <rect width="120" height="60" rx="8" fill="#7826b5" opacity="0.2"/>
    <path d="M25,15 C15,25 15,35 25,45 L15,55 C0,40 0,20 15,5 L25,15 Z" fill="#FFFFFF"/>
    <path d="M45,15 C35,25 35,35 45,45 L35,55 C20,40 20,20 35,5 L45,15 Z" fill="#FFFFFF"/>
    <text x="60" y="35" font-family="Arial" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">DevBridge</text>
  </svg>
  `;

  // Convert SVG to base64 for email embedding
  const base64Logo = Buffer.from(svgLogo).toString('base64');
  return `data:image/svg+xml;base64,${base64Logo}`;
};

// HTML for the logo with background
exports.getLogoHtml = () => {
  return `
  <div style="background-color: #7826b5; padding: 15px; border-radius: 8px; display: inline-block;">
    <img src="${exports.getLogoSvg()}" alt="DevBridge Logo" style="max-width: 120px; height: auto;" />
  </div>
  `;
};
