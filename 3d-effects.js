// Advanced Animation Effects
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the 3D Carousel
  initCarousel();

  // Initialize Magnetic Buttons
  initMagneticButtons();

  // Initialize Split Text Animation
  initSplitText();

  // Initialize Portfolio Showcase Items
  initPortfolioShowcase();
});

// 3D Carousel Functionality
function initCarousel() {
  const carousel = document.querySelector('.carousel-wrapper');
  const items = document.querySelectorAll('.carousel-item');
  const navBtns = document.querySelectorAll('.carousel-nav-btn');
  const arrowPrev = document.querySelector('.carousel-arrow.prev');
  const arrowNext = document.querySelector('.carousel-arrow.next');

  if (!carousel || items.length === 0) return;

  let currentIndex = 0;
  const totalItems = items.length;
  const theta = 2 * Math.PI / totalItems;
  const radius = 300;

  // Position all items in a circle
  function updateCarousel() {
    items.forEach((item, index) => {
      const angle = theta * (index - currentIndex);
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius - radius;

      item.style.transform = `translateX(${x}px) translateZ(${z}px)`;
      item.style.opacity = index === currentIndex ? 1 : 0.6;
      item.style.zIndex = index === currentIndex ? 10 : 5;

      // Update navigation buttons
      if (navBtns[index]) {
        navBtns[index].classList.toggle('active', index === currentIndex);
      }
    });
  }

  // Initialize positions
  updateCarousel();

  // Navigation buttons click event
  navBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      currentIndex = index;
      updateCarousel();
    });
  });

  // Arrow navigation
  if (arrowPrev) {
    arrowPrev.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + totalItems) % totalItems;
      updateCarousel();
    });
  }

  if (arrowNext) {
    arrowNext.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % totalItems;
      updateCarousel();
    });
  }

  // Auto rotate (optional)
  let autoRotate = setInterval(() => {
    currentIndex = (currentIndex + 1) % totalItems;
    updateCarousel();
  }, 5000);

  // Pause auto-rotate on hover
  carousel.parentElement.addEventListener('mouseenter', () => {
    clearInterval(autoRotate);
  });

  carousel.parentElement.addEventListener('mouseleave', () => {
    autoRotate = setInterval(() => {
      currentIndex = (currentIndex + 1) % totalItems;
      updateCarousel();
    }, 5000);
  });

  // Touch events for mobile
  let touchStartX = 0;
  let touchEndX = 0;

  carousel.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  carousel.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    if (touchEndX < touchStartX) {
      // Swipe left
      currentIndex = (currentIndex + 1) % totalItems;
    } else if (touchEndX > touchStartX) {
      // Swipe right
      currentIndex = (currentIndex - 1 + totalItems) % totalItems;
    }
    updateCarousel();
  }
}

// Magnetic Button Effect
function initMagneticButtons() {
  const magneticButtons = document.querySelectorAll('.magnetic-btn');

  magneticButtons.forEach(btn => {
    btn.addEventListener('mousemove', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const moveX = (x - centerX) / 10;
      const moveY = (y - centerY) / 10;

      this.style.transform = `translate(${moveX}px, ${moveY}px) translateY(-5px)`;
    });

    btn.addEventListener('mouseleave', function() {
      this.style.transform = 'translate(0, 0)';
    });

    btn.addEventListener('click', function() {
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = 'scale(1)';
      }, 100);
    });
  });
}

// Split Text Animation
function initSplitText() {
  const splitTextElements = document.querySelectorAll('.split-text');

  splitTextElements.forEach(element => {
    let text = element.textContent;
    element.textContent = '';

    let words = text.split(' ');

    words.forEach(word => {
      let wordSpan = document.createElement('span');
      wordSpan.className = 'word';

      for (let i = 0; i < word.length; i++) {
        let charSpan = document.createElement('span');
        charSpan.className = 'char';
        charSpan.textContent = word[i];
        charSpan.style.transitionDelay = `${i * 0.05}s`;
        wordSpan.appendChild(charSpan);
      }

      element.appendChild(wordSpan);
    });
  });

  // Detect when elements enter viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.1 });

  splitTextElements.forEach(el => {
    observer.observe(el);
  });
}

// Portfolio Showcase Animation
function initPortfolioShowcase() {
  const showcaseItems = document.querySelectorAll('.showcase-item');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 100);
      }
    });
  }, { threshold: 0.1 });

  showcaseItems.forEach(item => {
    observer.observe(item);
  });
}

// Mouse Trailer Effect
function initMouseTrailer() {
  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  document.body.appendChild(cursor);

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  document.body.appendChild(dot);

  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';

    dot.style.left = e.clientX + 'px';
    dot.style.top = e.clientY + 'px';
  });

  // Add hover effect to interactive elements
  const interactiveElements = document.querySelectorAll('a, button, .project-card, .carousel-item, .showcase-item');

  interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
      cursor.style.borderColor = 'var(--primary-color)';
    });

    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
  });
}

// Call mouse trailer effect initialization if not on touch device
if (!('ontouchstart' in document.documentElement)) {
  initMouseTrailer();
}
