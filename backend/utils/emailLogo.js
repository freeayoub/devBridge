/**
 * Logo for email templates
 * Using the actual app logo
 */

// Base64 encoded SVG logo for the app
exports.getLogoSvg = () => {
  // This is a simplified version of the app logo as an SVG
  const svgLogo = `
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">
    <path d="M30,15 C20,25 20,35 30,45 L20,55 C5,40 5,20 20,5 L30,15 Z" fill="#FFFFFF"/>
    <path d="M50,15 C40,25 40,35 50,45 L40,55 C25,40 25,20 40,5 L50,15 Z" fill="#FFFFFF"/>
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
