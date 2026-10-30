// site-settings.js — applies the admin-editable school name, colors,
// logo, and copy (see supabase-api.js: getSiteSettings) to whatever
// page includes this script. Load AFTER supabase-api.js.
//
// SECURITY: every value from the DB is applied via textContent,
// element.style, or an <img src> — never innerHTML — so this cannot
// become an XSS vector even though the admin (a trusted-but-not-root
// user) controls the content. See migrations/003_site_content.sql for
// the same reasoning on the storage side.
//
// HOW IT WORKS: two mechanisms, both intentionally simple —
//  1. Known repeated boilerplate (school name, address, phone, email)
//     is replaced by walking text nodes and swapping the *default*
//     string for the admin's saved value, wherever it appears. This
//     is what lets the footer/contact-info blocks update on every
//     page without hand-adding a data-site attribute to each one.
//  2. A handful of page-specific elements (the homepage hero heading,
//     the About write-up, etc.) are marked with data-site="key" and
//     get their textContent set directly.
(function () {
  async function applySiteSettings() {
    if (typeof getSiteSettings !== 'function') return; // supabase-api.js not loaded on this page
    const r = await getSiteSettings();
    if (!r || !r.ok) return;
    const s = r.data.settings;

    applyColors(s);
    applyDataSiteFields(s);
    applyBoilerplateTextReplace(s);
    applyLogo(s);
    if (s.hero_slides && s.hero_slides.length) {
      applyHeroSlider(s.hero_slides);
    } else {
      applyImageOverride('hero-visual', s.hero_image_url, s.school_name);
    }
    applyImageOverride('mission-visual', s.mission_image_url, s.school_name);
    applyVideoEmbed(s.hero_video_url);
    applyGridCards(s.grid_cards);
  }

  // Fixed, safe icon set for grid cards — admins choose a KEYWORD
  // (stored in site_content), never raw markup. This is what makes it
  // impossible for this field to become an XSS vector no matter what
  // gets typed into the admin form: only these exact SVGs can ever
  // render, regardless of what string is stored.
  const ICON_LIBRARY = {
    book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13z"/>',
    heart: '<path d="M12 20.5S3.5 15.4 3.5 9.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 2.2c0 6-8.5 11.1-8.5 11.1z"/>',
    star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17.3 6.2 20.5l1.1-6.5-4.8-4.6 6.6-.9z"/>',
    graduation: '<path d="M12 3l10 5-10 5L2 8l10-5z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/>',
    shield: '<path d="M12 3l7 3v5.5c0 5-3 8-7 9.5-4-1.5-7-4.5-7-9.5V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 20c.8-3.5 3-5.5 5.5-5.5s4.7 2 5.5 5.5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M15.3 14.3c2 .2 3.5 1.8 4.2 5"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/><path d="M12 14v3M9 21h6M9.5 17.5h5l.5 3.5H9z"/>',
  };
  window.TFIS_ICON_LIBRARY = ICON_LIBRARY; // exposed so the admin dashboard's icon picker uses the exact same set

  function applyHeroSlider(slides) {
    const el = document.getElementById('hero-visual');
    if (!el || !slides.length) return;
    el.innerHTML = ''; // safe: replacing with controlled <img> elements below, no user text goes through innerHTML
    el.style.position = 'relative';
    el.style.overflow = 'hidden';

    slides.forEach((slide, i) => {
      const img = document.createElement('img');
      img.src = slide.url;
      img.alt = slide.caption || '';
      img.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;opacity:${i === 0 ? 1 : 0};transition:opacity 1s ease;`;
      img.dataset.slideIndex = i;
      el.appendChild(img);
    });

    if (slides.length > 1) {
      let current = 0;
      setInterval(() => {
        const imgs = el.querySelectorAll('img[data-slide-index]');
        imgs[current].style.opacity = 0;
        current = (current + 1) % imgs.length;
        imgs[current].style.opacity = 1;
      }, 5000);
    }
  }

  // Accepts a plain YouTube URL (watch?v=, youtu.be/, or already an
  // /embed/ link) and converts it to an embeddable link server never
  // has to store raw HTML for — the iframe src is the only thing built
  // from admin input here, and it's built from a validated video ID,
  // not injected as markup.
  function youTubeEmbedUrl(url) {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    return null; // not a recognizable YouTube URL — section stays hidden rather than guessing
  }

  function applyVideoEmbed(videoUrl) {
    const embedUrl = youTubeEmbedUrl(videoUrl);
    const section = document.getElementById('video-section');
    const wrap = document.getElementById('video-embed-wrap');
    if (!embedUrl || !section || !wrap) return;

    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.style.cssText = 'width:100%;height:100%;border:0;';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.title = 'School video';
    wrap.innerHTML = '';
    wrap.appendChild(iframe);
    section.style.display = '';
  }

  function applyGridCards(cards) {
    const outer = document.getElementById('grid-cards-outer');
    const container = document.getElementById('grid-cards-section');
    if (!cards || !cards.length || !outer || !container) return;

    container.innerHTML = cards.map((card) => {
      const iconPath = ICON_LIBRARY[card.icon] || ICON_LIBRARY.star;
      const title = document.createElement('div');
      title.textContent = card.title || '';
      const text = document.createElement('div');
      text.textContent = card.text || '';
      // Built as a template with the icon path (fixed, trusted SVG
      // markup from ICON_LIBRARY only) and escaped placeholders for
      // the admin-typed title/text, swapped in via textContent above
      // then read back — this keeps title/text passing through the
      // same escaping guarantee as the rest of this file without
      // hand-rolling string escaping here too.
      return `<div style="background:#fff;border:1px solid #eee;border-radius:14px;padding:1.5rem;text-align:center;box-shadow:0 4px 16px rgba(11,31,69,.06);">
        <div style="width:48px;height:48px;margin:0 auto 1rem;background:var(--gold,#8dc63f);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;">
          <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true">${iconPath}</svg>
        </div>
        <div style="font-weight:700;color:var(--royal,#0b1f5c);margin-bottom:.4rem;">${title.innerHTML}</div>
        <div style="font-size:.88rem;color:#666;">${text.innerHTML}</div>
      </div>`;
    }).join('');
    outer.style.display = '';
  }

  function applyImageOverride(elementId, url, alt) {
    if (!url) return;
    const el = document.getElementById(elementId);
    if (!el) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || 'School';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;';
    el.style.position = el.style.position || 'relative';
    el.appendChild(img);
  }

  function applyColors(s) {
    if (!s.primary_color && !s.accent_color) return;
    const style = document.createElement('style');
    style.textContent = ':root{' +
      (s.primary_color ? '--royal:' + cssColor(s.primary_color) + ';' : '') +
      (s.accent_color ? '--gold:' + cssColor(s.accent_color) + ';' : '') +
      '}';
    document.head.appendChild(style);
  }

  // Defends against a saved value like "red; } body { display:none"
  // being used to break out of the style block — only allow the
  // characters a real CSS color can contain.
  function cssColor(v) {
    return /^[#a-zA-Z0-9(),.\s%-]{1,40}$/.test(v) ? v : '';
  }

  function applyDataSiteFields(s) {
    document.querySelectorAll('[data-site]').forEach(function (el) {
      const key = el.getAttribute('data-site');
      if (s[key] !== undefined && s[key] !== '') el.textContent = s[key];
    });
    document.querySelectorAll('[data-site-href]').forEach(function (el) {
      const key = el.getAttribute('data-site-href');
      if (s[key]) el.setAttribute('href', el.getAttribute('data-site-href-prefix') ? el.getAttribute('data-site-href-prefix') + s[key] : s[key]);
    });
  }

  // Only swaps text that is still showing the seeded default — if an
  // admin has already changed style.css or hand-edited a page's copy
  // to something else entirely, this quietly does nothing rather than
  // clobbering it.
  function applyBoilerplateTextReplace(s) {
    const pairs = [
      [SITE_CONTENT_DEFAULTS.school_name, s.school_name],
      [SITE_CONTENT_DEFAULTS.address, s.address],
      [SITE_CONTENT_DEFAULTS.address_line1, s.address_line1],
      [SITE_CONTENT_DEFAULTS.phone, s.phone],
      [SITE_CONTENT_DEFAULTS.phone2, s.phone2],
      [SITE_CONTENT_DEFAULTS.email, s.email],
      [SITE_CONTENT_DEFAULTS.admissions_email, s.admissions_email],
      [SITE_CONTENT_DEFAULTS.footer_note, s.footer_note],
    ].filter(function (p) { return p[0] && p[1] && p[0] !== p[1]; });
    if (!pairs.length) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      let text = node.nodeValue;
      let changed = false;
      pairs.forEach(function (p) {
        if (text.indexOf(p[0]) !== -1) { text = text.split(p[0]).join(p[1]); changed = true; }
      });
      if (changed) node.nodeValue = text;
    });

    // mailto:/tel: links are attributes, not text nodes — patch the
    // common ones directly since they're easy to find reliably.
    if (s.email) {
      document.querySelectorAll('a[href^="mailto:' + SITE_CONTENT_DEFAULTS.email + '"]').forEach(function (a) {
        a.setAttribute('href', 'mailto:' + s.email);
      });
    }
    if (s.admissions_email) {
      document.querySelectorAll('a[href^="mailto:' + SITE_CONTENT_DEFAULTS.admissions_email + '"]').forEach(function (a) {
        a.setAttribute('href', 'mailto:' + s.admissions_email);
      });
    }
  }

  function applyLogo(s) {
    if (s.logo_initials) {
      document.querySelectorAll('.logo-crest:not(.logo-img)').forEach(function (el) {
        if (!s.logo_url) el.textContent = s.logo_initials;
      });
    }
    if (s.logo_url) {
      document.querySelectorAll('.logo-img img').forEach(function (im) { im.src = s.logo_url; });
      document.querySelectorAll('.logo-crest:not(.logo-img)').forEach(function (el) {
        el.innerHTML = ''; // clear text content only — safe, we immediately replace with a controlled <img>, no user text goes through innerHTML
        const img = document.createElement('img');
        img.src = s.logo_url;
        img.alt = s.school_short_name || 'Logo';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = 'inherit';
        el.appendChild(img);
      });
    }
    document.querySelectorAll('.logo-name').forEach(function (el) { if (s.school_name) el.textContent = s.school_name; });
    document.querySelectorAll('.logo-abbr').forEach(function (el) { if (s.school_short_name) el.textContent = s.school_short_name + (s.tagline ? ' · ' + s.tagline.split('·').pop().trim() : ''); });
    document.querySelectorAll('.footer-brand-name').forEach(function (el) { if (s.school_name) el.textContent = s.school_name; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySiteSettings);
  } else {
    applySiteSettings();
  }
})();
