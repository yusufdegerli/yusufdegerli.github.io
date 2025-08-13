// Modern Portfolio JavaScript

// Sayfa yüklenme animasyonu
document.addEventListener("DOMContentLoaded", () => {
  // Initialize GSAP and ScrollTrigger
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    initGSAPAnimations();
  }

  // Initialize Locomotive Scroll for smooth scrolling if available
  let locoScroll;
  if (window.LocomotiveScroll) {
    locoScroll = new LocomotiveScroll({
      el: document.querySelector('[data-scroll-container]') || document.body,
      smooth: true,
      multiplier: 1,
      lerp: 0.05
    });

    // Update ScrollTrigger when Locomotive Scroll updates
    locoScroll.on('scroll', ScrollTrigger.update);

    // Tell ScrollTrigger to use these proxy methods
    ScrollTrigger.scrollerProxy(document.body, {
      scrollTop(value) {
        return arguments.length ? locoScroll.scrollTo(value, 0, 0) : locoScroll.scroll.instance.scroll.y;
      },
      getBoundingClientRect() {
        return {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight};
      },
      pinType: document.body.style.transform ? "transform" : "fixed"
    });
    
    // Each time the window updates, refresh ScrollTrigger and Locomotive Scroll
    ScrollTrigger.addEventListener('refresh', () => locoScroll.update());
    ScrollTrigger.refresh();
  }

  // Yükleme animasyonu
  const loader = document.querySelector('.loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.style.overflow = 'visible';
      // Initialize animations after loader is hidden
      initAnimations();
    }, 1000);
  } else {
    initAnimations();
  }

  // Initialize Barba.js for page transitions if available
  if (window.barba) {
    barba.init({
      transitions: [{
        name: 'opacity-transition',
        leave(data) {
          return gsap.to(data.current.container, {
            opacity: 0,
            duration: 0.5
          });
        },
        enter(data) {
          return gsap.from(data.next.container, {
            opacity: 0,
            duration: 0.5
          });
        }
      }]
    });
  }

  // Custom cursor effect
  const cursorFollower = document.createElement('div');
  cursorFollower.className = 'cursor-follower';
  document.body.appendChild(cursorFollower);

  const cursorDot = document.createElement('div');
  cursorDot.className = 'cursor-dot';
  document.body.appendChild(cursorDot);

  document.addEventListener('mousemove', (e) => {
    gsap.to(cursorFollower, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.3
    });
    
    gsap.to(cursorDot, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.1
    });
  });

  document.addEventListener('mouseenter', () => {
    gsap.to(cursorFollower, {
      opacity: 1,
      scale: 1,
      duration: 0.3
    });
  });

  document.addEventListener('mouseleave', () => {
    gsap.to(cursorFollower, {
      opacity: 0,
      scale: 0.5,
      duration: 0.3
    });
  });

  // Add hover effect to all links and buttons
  const hoverElements = document.querySelectorAll('a, button, .project-card, .social-link, .skill-badge');
  hoverElements.forEach(element => {
    element.addEventListener('mouseenter', () => {
      gsap.to(cursorFollower, {
        scale: 1.5,
        borderColor: 'rgba(59, 130, 246, 0.8)',
        duration: 0.3
      });
    });

    element.addEventListener('mouseleave', () => {
      gsap.to(cursorFollower, {
        scale: 1,
        borderColor: 'rgba(59, 130, 246, 0.4)',
        duration: 0.3
      });
    });
  });

  // Navbar scroll animasyonu
  const header = document.querySelector('header');
  const navLinks = document.querySelectorAll('nav a');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Scroll bağlantıları animasyonu
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();

      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);

      if (locoScroll) {
        locoScroll.scrollTo(targetSection);
      } else {
        window.scrollTo({
          top: targetSection.offsetTop - 80,
          behavior: 'smooth'
        });
      }

      // Mobil menüyü kapat (eğer açıksa)
      if (document.querySelector('.mobile-menu').classList.contains('active')) {
        toggleMobileMenu();
      }
    });
  });

  // Initialize skill progress animations
  initSkillProgressBars();

  // Type effect for hero section
  if (window.Typed && document.querySelector('.typed-text')) {
    new Typed('.typed-text', {
      strings: ['Flutter Geliştirici', 'UI/UX Tasarımcı', 'Mobil Uygulama Uzmanı'],
      typeSpeed: 50,
      backSpeed: 30,
      backDelay: 2000,
      loop: true
    });
  }

  // Add parallax effect to elements with data-parallax-element attribute
  initParallaxEffect();
});

// Parallax effect initialization
function initParallaxEffect() {
  const parallaxElements = document.querySelectorAll('[data-parallax-element]');
  
  window.addEventListener('mousemove', (e) => {
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    parallaxElements.forEach(element => {
      const speedX = element.getAttribute('data-parallax-speed-x') || 20;
      const speedY = element.getAttribute('data-parallax-speed-y') || 20;
      
      const moveX = (mouseX - 0.5) * speedX;
      const moveY = (mouseY - 0.5) * speedY;
      
      gsap.to(element, {
        x: moveX,
        y: moveY,
        duration: 0.3
      });
    });
  });
}

// Initialize animations
function initAnimations() {
  // GSAP animations
  if (window.gsap) {
    // Hero section animations
    gsap.from(".hero-gradient .anim-element", {
      opacity: 0,
      y: 50,
      stagger: 0.2,
      duration: 1,
      ease: "power3.out"
    });

    // Floating elements animations
    gsap.to(".floating-element-1", {
      y: 20,
      x: 10,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    gsap.to(".floating-element-2", {
      y: -20,
      x: -10,
      duration: 2.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 0.3
    });

    gsap.to(".floating-element-3", {
      y: 15,
      x: -15,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 0.6
    });
  }

  // Intersections Observer ile bölüm animasyonları
  const sections = document.querySelectorAll("section");
  const options = {
    threshold: 0.1,
    rootMargin: "0px 0px -100px 0px"
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("opacity-100", "translate-y-0");

        // Bölüm içindeki animasyonlu elementler
        const animElements = entry.target.querySelectorAll('.anim-element');
        animElements.forEach((el, index) => {
          setTimeout(() => {
            el.classList.add('animate-fadeInUp');
          }, 100 * index);
        });

        // Animate skill progress bars if they exist in this section
        if (entry.target.id === 'skills') {
          animateSkillProgressBars();
        }
      }
    });
  }, options);

  sections.forEach(section => {
    section.classList.add("opacity-0", "translate-y-4", "transition-all", "duration-700");
    observer.observe(section);
  });
}

// Initialize GSAP ScrollTrigger animations
function initGSAPAnimations() {
  // Reveal animations for sections
  gsap.utils.toArray('.gsap-reveal').forEach(section => {
    gsap.fromTo(section, 
      {
        y: 50,
        opacity: 0,
        visibility: 'hidden'
      }, 
      {
        y: 0,
        opacity: 1,
        visibility: 'visible',
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });

  // Process steps animation
  gsap.utils.toArray('.process-step').forEach((step, index) => {
    gsap.fromTo(step, 
      {
        y: 50,
        opacity: 0
      }, 
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        delay: index * 0.2,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.process-steps',
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });

  // Project cards stagger animation
  gsap.from('.project-card', {
    opacity: 0,
    y: 50,
    stagger: 0.2,
    duration: 0.8,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '.project-card',
      start: "top 80%",
      toggleActions: "play none none reverse"
    }
  });
}

// Initialize skill progress bars
function initSkillProgressBars() {
  const progressBars = document.querySelectorAll('.skill-progress');
  
  progressBars.forEach(bar => {
    // Store the target width in a custom property
    const targetWidth = bar.style.width;
    bar.style.setProperty('--progress-width', targetWidth);
    // Set initial width to 0
    bar.style.width = '0';
  });
}

// Animate skill progress bars
function animateSkillProgressBars() {
  const progressBars = document.querySelectorAll('.skill-progress');
  
  progressBars.forEach((bar, index) => {
    setTimeout(() => {
      bar.classList.add('animate');
    }, index * 200);
  });
}

// Mobil menü toggle
function toggleMobileMenu() {
  const mobileMenu = document.querySelector('.mobile-menu');
  const menuButton = document.querySelector('.menu-button');

  mobileMenu.classList.toggle('active');
  menuButton.classList.toggle('active');

  // Body scroll'u kilitlemek veya açmak
  document.body.classList.toggle('menu-open');

  // Menü açıkken yüksekliği ayarlamak için
  if (mobileMenu.classList.contains('active')) {
    mobileMenu.style.height = 'calc(100vh - 4rem)';
  } else {
    mobileMenu.style.height = '0';
  }
}

// Project filter functionality
function filterProjects(filter) {
  const projects = document.querySelectorAll('.project-card');
  const filterButtons = document.querySelectorAll('.filter-btn');

  // Active filter button
  filterButtons.forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Filter projects with GSAP animation
  if (window.gsap) {
    // First hide all projects
    gsap.to(projects, {
      opacity: 0,
      y: 20,
      duration: 0.3,
      stagger: 0.05,
      onComplete: () => {
        // Then filter and show relevant ones
        projects.forEach(project => {
          if (filter === 'all' || project.dataset.category === filter) {
            project.style.display = 'block';
          } else {
            project.style.display = 'none';
          }
        });
        
        // Animate the displayed projects back in
        gsap.to(
          filter === 'all' 
            ? projects 
            : document.querySelectorAll(`.project-card[data-category="${filter}"]`), 
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.1
          }
        );
      }
    });
  } else {
    // Fallback for no GSAP
    projects.forEach(project => {
      if (filter === 'all') {
        project.style.display = 'block';
        setTimeout(() => {
          project.classList.remove('hidden');
        }, 10);
      } else if (project.dataset.category === filter) {
        project.style.display = 'block';
        setTimeout(() => {
          project.classList.remove('hidden');
        }, 10);
      } else {
        project.classList.add('hidden');
        setTimeout(() => {
          project.style.display = 'none';
        }, 500);
      }
    });
  }
}

// Dark/Light mode toggle
function toggleDarkMode() {
  const toggle = document.querySelector('.dark-mode-toggle');
  toggle.classList.toggle('active');
  document.body.classList.toggle('light-mode');

  // Store preference in local storage
  const isDarkMode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  localStorage.setItem('theme', isDarkMode);
}

// Form submission handler with validation
function submitContactForm(event) {
  event.preventDefault();

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const messageInput = document.getElementById('message');
  const submitButton = document.querySelector('.submit-btn');
  const form = document.getElementById('contact-form');

  // Simple validation
  let isValid = true;

  if (!nameInput.value.trim()) {
    markInvalid(nameInput, 'İsim gerekli');
    isValid = false;
  } else {
    markValid(nameInput);
  }

  if (!emailInput.value.trim() || !isValidEmail(emailInput.value)) {
    markInvalid(emailInput, 'Geçerli bir e-posta giriniz');
    isValid = false;
  } else {
    markValid(emailInput);
  }

  if (!messageInput.value.trim()) {
    markInvalid(messageInput, 'Mesaj gerekli');
    isValid = false;
  } else {
    markValid(messageInput);
  }

  if (isValid) {
    submitButton.disabled = true;
    submitButton.innerText = 'Gönderiliyor...';

    // Simulate sending (In real project, use fetch API)
    setTimeout(() => {
      form.reset();
      submitButton.disabled = false;
      submitButton.innerText = 'Gönder';

      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'success-message bg-green-500 text-white p-4 rounded mt-4';
      successMsg.innerText = 'Mesajınız başarıyla gönderildi!';
      form.appendChild(successMsg);

      setTimeout(() => {
        if (window.gsap) {
          gsap.to(successMsg, {
            opacity: 0,
            y: -20,
            duration: 0.5,
            onComplete: () => successMsg.remove()
          });
        } else {
          successMsg.remove();
        }
      }, 5000);
    }, 1500);
  }
}

// Helper functions for form validation
function isValidEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

function markInvalid(input, message) {
  input.classList.add('border-red-500');
  input.classList.remove('border-green-500');

  // Add error message
  const errorElement = input.parentElement.querySelector('.error-message');
  if (errorElement) {
    errorElement.innerText = message;
  } else {
    const error = document.createElement('p');
    error.className = 'error-message text-red-500 text-sm mt-1';
    error.innerText = message;
    input.parentElement.appendChild(error);
  }
}

function markValid(input) {
  input.classList.remove('border-red-500');
  input.classList.add('border-green-500');

  // Remove error message
  const errorElement = input.parentElement.querySelector('.error-message');
  if (errorElement) {
    errorElement.remove();
  }
}

// Initialize theme from stored preference
function initTheme() {
  const storedTheme = localStorage.getItem('theme');

  if (storedTheme === 'light') {
    document.body.classList.add('light-mode');
    document.querySelector('.dark-mode-toggle')?.classList.add('active');
  }
}

// Initialize theme on page load
initTheme();
