/**
 * Google Business Rating Component for OM Mobile Art
 * Displays Google Business Profile Rating & Verified Google Reviews Badge
 */
(function() {
  const GOOGLE_BUSINESS_URL = 'https://maps.app.goo.gl/t14LWUswCdPH8ShVA';
  const STORE_GOOGLE_RATING = 4.9;
  const STORE_GOOGLE_REVIEWS_COUNT = 256;

  window.renderProductRatingHTML = function (rating, count, options = {}) {
    const size = options.size || 'sm';
    const isCard = options.isCard || false;

    const ratingVal = rating || STORE_GOOGLE_RATING;
    const reviewsCount = count || STORE_GOOGLE_REVIEWS_COUNT;

    const starSizeClass = size === 'xs' ? 'text-[14px]' : size === 'md' ? 'text-[18px]' : size === 'lg' ? 'text-[22px]' : 'text-[16px]';
    const textSizeClass = size === 'xs' ? 'text-[11px]' : size === 'md' ? 'text-sm' : size === 'lg' ? 'text-base' : 'text-xs';

    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
      starsHTML += `<span class="material-symbols-outlined ${starSizeClass}" style="font-variation-settings: 'FILL' 1; color: #FFB800;">star</span>`;
    }

    const labelText = isCard 
      ? `${ratingVal} ★ (${reviewsCount})`
      : `${ratingVal} ★★★★★ (${reviewsCount} Google Reviews)`;

    return `
      <a href="${GOOGLE_BUSINESS_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity cursor-pointer group" title="View Google Business Reviews for OM Mobile Art">
        <div class="flex items-center text-[#FFB800]">${starsHTML}</div>
        <span class="${textSizeClass} font-bold text-[#1E293B] group-hover:text-[#0077B6]">${labelText}</span>
      </a>
    `;
  };

  window.renderGoogleBadgeHTML = function() {
    return `
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] text-xs font-semibold shadow-sm">
        <svg class="w-4 h-4 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span>Google Verified Reviews</span>
      </div>
    `;
  };

  window.renderGoogleReviewButtonHTML = function(text = "⭐ Review us on Google") {
    return `
      <a href="${GOOGLE_BUSINESS_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4285F4] hover:bg-[#3367D6] text-white font-bold text-sm shadow-md transition-all transform hover:-translate-y-0.5">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        </svg>
        <span>${text}</span>
      </a>
    `;
  };
})();
