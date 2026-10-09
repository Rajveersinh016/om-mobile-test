/**
 * OM Mobile Art — Premium Animations Orchestrator (animations.js)
 * High-performance, lightweight handlers for transitions, ripples, shakes, counts, and confetti.
 */

(function () {
  'use strict';

  // Ensure namespace exists
  window.OM = window.OM || {};

  // ─── 1. Page Fade Transitions ───
  function initPageTransitions() {
    // Fade-in on load
    document.body.classList.add('page-fade-enter');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add('page-fade-enter-active');
        // Clean up classes after animation ends (350ms)
        setTimeout(() => {
          document.body.classList.remove('page-fade-enter', 'page-fade-enter-active');
        }, 400);
      });
    });

    // Intercept clicks on links for fade-out exit transition
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const target = anchor.getAttribute('target');

      // Check if it's an internal, navigatable page link
      if (
        href &&
        !href.startsWith('#') &&
        !href.startsWith('javascript:') &&
        target !== '_blank' &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        // Prevent immediate navigation
        e.preventDefault();
        
        document.body.classList.add('page-fade-exit');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.body.classList.add('page-fade-exit-active');
            setTimeout(() => {
              window.location.href = href;
            }, 250); // duration matches variables.css transition-slow
          });
        });
      }
    });
  }

  // ─── 2. Scroll Reveal Engine (Intersection Observer) ───
  function initScrollReveal() {
    const options = {
      root: null, // viewport
      rootMargin: '0px -10% -10% 0px', // slightly inset for aesthetic trigger
      threshold: 0.05
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target); // only reveal once
        }
      });
    }, options);

    // Watch custom elements and all section elements in main, including dynamic sections
    const targets = document.querySelectorAll('.reveal-on-scroll, main > section, main section.py-section-padding, .fade-up-scroll-custom, #homepage-sections-container > section');
    targets.forEach(target => {
      if (!target.classList.contains('fade-up-scroll-custom') && !target.classList.contains('reveal-on-scroll')) {
        target.classList.add('reveal-on-scroll');
      }
      observer.observe(target);
    });
  }

  // Expose scroll reveal globally for dynamic CMS rendering
  window.OM.initScrollReveal = initScrollReveal;

  // ─── 3. Ripple Touch Feedback ───
  function createRipple(e) {
    const btn = e.currentTarget;
    
    // Create ripple container if not exists
    let container = btn.querySelector('.ripple-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'ripple-container';
      btn.appendChild(container);
    }

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    
    // Check background color and adjust ripple contrast
    const btnStyle = window.getComputedStyle(btn);
    const bg = btnStyle.backgroundColor;
    // If background is very light or transparent, make ripple dark
    if (bg === 'transparent' || bg.includes('255, 255, 255') || bg === 'rgb(249, 249, 249)' || bg === 'rgb(255, 255, 255)') {
      wave.classList.add('ripple-dark');
    }

    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;

    container.appendChild(wave);

    wave.addEventListener('animationend', () => {
      wave.remove();
    });
  }

  function initRippleEffect() {
    // Watch all premium buttons and primary actions
    const selectors = '.btn-premium, button, a.bg-primary, a.bg-footer-bg, input[type="submit"]';
    document.addEventListener('mousedown', (e) => {
      const btn = e.target.closest(selectors);
      if (btn) {
        // Ensure relative positioning for ripple containment
        const style = window.getComputedStyle(btn);
        if (style.position === 'static') {
          btn.style.position = 'relative';
        }
        createRipple({
          currentTarget: btn,
          clientX: e.clientX,
          clientY: e.clientY
        });
      }
    });
  }

  // ─── 4. Validation Error Shake ───
  window.OM.shakeElement = function (el) {
    if (!el) return;
    el.classList.remove('animate-shake');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('animate-shake');
    el.addEventListener('animationend', () => {
      el.classList.remove('animate-shake');
    }, { once: true });
  };

  // ─── 5. Smooth Count-Up Animation (60 FPS) ───
  window.OM.animateCount = function (el, start, end, duration = 1000, formatFn = (val) => Math.round(val)) {
    if (!el) return;
    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Easing expo-out
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = start + easeProgress * (end - start);
      el.textContent = formatFn(val);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }
    window.requestAnimationFrame(step);
  };

  // ─── 6. Confetti Particle System (Canvas) ───
  window.OM.triggerConfetti = function () {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const colors = ['#35567F', '#3A78A0', '#49AEB2', '#A6DDD6', '#2C4A6B', '#111827'];
    const particles = [];

    // Initialize particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: width / 2,
        y: height / 2 + 50,
        radius: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        speedX: Math.random() * 20 - 10,
        speedY: Math.random() * -15 - 5,
        gravity: 0.4,
        opacity: 1
      });
    }

    let animationId;
    const duration = 3000;
    const startTime = Date.now();

    function update() {
      ctx.clearRect(0, 0, width, height);

      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        cancelAnimationFrame(animationId);
        canvas.remove();
        return;
      }

      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += p.gravity;
        p.rotation += p.rotationSpeed;
        
        // Fade out in the last second
        if (elapsed > duration - 1000) {
          p.opacity = 1 - (elapsed - (duration - 1000)) / 1000;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        
        // Draw confetti piece (rectangle)
        ctx.fillRect(-p.radius, -p.radius / 1.5, p.radius * 2, p.radius * 1.3);
        ctx.restore();
      });

      animationId = requestAnimationFrame(update);
    }

    update();
  };

  // ─── 7. Accordion Interactions ───
  function initAccordions() {
    document.addEventListener('click', (e) => {
      const header = e.target.closest('.accordion-header');
      if (!header) return;

      const parent = header.parentElement;
      const content = parent.querySelector('.accordion-content');
      const icon = header.querySelector('.material-symbols-outlined');

      if (content) {
        const isOpen = content.classList.contains('open');
        
        // Close others in same accordion group if needed
        const group = parent.closest('.accordion-group');
        if (group) {
          group.querySelectorAll('.accordion-content.open').forEach(openContent => {
            if (openContent !== content) {
              openContent.classList.remove('open');
              openContent.style.maxHeight = '0';
              const otherIcon = openContent.parentElement.querySelector('.accordion-header .material-symbols-outlined');
              if (otherIcon) otherIcon.textContent = 'add';
            }
          });
        }

        if (isOpen) {
          content.classList.remove('open');
          content.style.maxHeight = '0';
          if (icon) icon.textContent = 'add';
        } else {
          content.classList.add('open');
          content.style.maxHeight = `${content.scrollHeight}px`;
          if (icon) icon.textContent = 'remove';
        }
      }
    });
  }

  // ─── Initialize All Global Handlers on DOMContentLoaded ───
  document.addEventListener('DOMContentLoaded', () => {
    initPageTransitions();
    initScrollReveal();
    initRippleEffect();
    initAccordions();
  });


})();
