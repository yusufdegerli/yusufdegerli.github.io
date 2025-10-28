
// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_9g35zqx';
const EMAILJS_TEMPLATE_ID = 'template_8vb7g73';
const EMAILJS_PUBLIC_KEY = 'ZuSt59qnLq6eXtV3z';

// Language configuration
const languageConfig = {
  tr: {
    flag: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAzMiAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjI0IiBmaWxsPSIjRkY2QjM1Ii8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTIiIHI9IjQiIGZpbGw9IiNGRkZGRkYiLz4KPHN2ZyB4PSIxMiIgeT0iOCIgd2lkdGg9IjgiIGhlaWdodD0iOCI+CjxjaXJjbGUgY3g9IjQiIGN5PSI0IiByPSIxLjUiIGZpbGw9IiNGRjZCMzUiLz4KPC9zdmc+Cjwvc3ZnPg==',
    name: 'Türkçe'
  },
  en: {
    flag: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAzMiAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjI0IiBmaWxsPSIjMDAyNDY2Ii8+CjxyZWN0IHdpZHRoPSIzMiIgaGVpZ2h0PSI2IiBmaWxsPSIjRkZGRkZGIi8+CjxyZWN0IHk9IjYiIHdpZHRoPSIzMiIgaGVpZ2h0PSI2IiBmaWxsPSIjRkZGRkZGIi8+CjxyZWN0IHk9IjEyIiB3aWR0aD0iMzIiIGhlaWdodD0iNiIgZmlsbD0iI0ZGRkZGRiIvPgo8cmVjdCB5PSIxOCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjYiIGZpbGw9IiNGRkZGRkYiLz4KPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjI0IiBmaWxsPSIjRkZGRkZGIi8+CjxzdiB4PSIwIiB5PSIwIiB3aWR0aD0iMTIiIGhlaWdodD0iMjQiPgo8c3ZnIHg9IjEuNSIgeT0iMS41IiB3aWR0aD0iOSIgaGVpZ2h0PSIyMSI+CjxwYXRoIGQ9Ik0wIDBMOSAxMS41TDAgMjFWMFoiIGZpbGw9IiNGRkZGRkYiLz4KPHN2ZyB4PSIwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI5Ij4KPHN2ZyB4PSIwIiB5PSIxMiIgd2lkdGg9IjEiIGhlaWdodD0iOSI+Cjwvc3ZnPgo8L3N2Zz4KPC9zdmc+Cjwvc3ZnPg==',
    name: 'English'
  }
};

let currentLanguage = localStorage.getItem('language') || 'tr';
let translations = {};
let translationsLoaded = false;

// Load translations - Embedded translations as fallback
async function loadTranslations() {
  try {
    // JSON dosyalarını yüklemeyi dene
    const [trResponse, enResponse] = await Promise.all([
      fetch('./tr.json').catch(() => null),
      fetch('./en.json').catch(() => null)
    ]);
    
    if (trResponse && trResponse.ok && enResponse && enResponse.ok) {
      translations.tr = await trResponse.json();
      translations.en = await enResponse.json();
      console.log('Translations loaded from JSON files');
    } else {
      throw new Error('JSON files not accessible');
    }
  } catch (error) {
    console.warn('JSON files not found, using embedded translations:', error);
    
    // Fallback - gömülü çeviriler
    translations = {
      tr: {
        'nav.about': 'Hakkımda',
        'nav.skills': 'Yetenekler', 
        'nav.projects': 'Projeler',
        'nav.contact': 'İletişim',
        'hero.title': 'Flutter Geliştirici & UI Tasarımcı',
        'hero.greeting': 'Merhaba, Ben Yusuf',
        'hero.view_projects': 'Projelere Göz At',
        'hero.contact': 'İletişime Geç',
        'hero.quick_contact': 'Hızlı İletişim',
        'hero.call_me': 'Beni Ara',
        'about.section_title': 'Hakkımda',
        'about.title': 'Profesyonel bir',
        'about.subtitle': 'Flutter Geliştiricisiyim',
        'form.name': 'Adınız',
        'form.phone': 'Telefon Numaranız',
        'form.email': 'E-posta Adresiniz',
        'form.message': 'Mesajınız',
        'form.send': 'Gönder',
        'language.turkish': 'Türkçe',
        'language.english': 'English',
        'theme.dark_light': 'Koyu/Açık Mod',
        'contact.section_title': 'İletişim',
        'contact.subtitle': 'Benimle İletişime Geç',
        'contact.send_message': 'Mesaj Gönder'
      },
      en: {
        'nav.about': 'About',
        'nav.skills': 'Skills',
        'nav.projects': 'Projects', 
        'nav.contact': 'Contact',
        'hero.title': 'Flutter Developer & UI Designer',
        'hero.greeting': 'Hello, I\'m Yusuf',
        'hero.view_projects': 'View Projects',
        'hero.contact': 'Get In Touch',
        'hero.quick_contact': 'Quick Contact', 
        'hero.call_me': 'Call Me',
        'about.section_title': 'About',
        'about.title': 'I am a professional',
        'about.subtitle': 'Flutter Developer',
        'form.name': 'Your Name',
        'form.phone': 'Your Phone Number',
        'form.email': 'Your Email',
        'form.message': 'Your Message', 
        'form.send': 'Send',
        'language.turkish': 'Türkçe',
        'language.english': 'English',
        'theme.dark_light': 'Dark/Light Mode',
        'contact.section_title': 'Contact',
        'contact.subtitle': 'Get In Touch With Me',
        'contact.send_message': 'Send Message'
      }
    };
  }
  
  translationsLoaded = true;
  console.log('Translations loaded successfully:', translations);
}

// Sayfa yüklenme 
document.addEventListener("DOMContentLoaded", async () => {
  console.log('DOM Content Loaded');
  
  // Çevirileri yükle
  await loadTranslations();
  
  // EmailJS'i başlat
  if (window.emailjs) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  // Dil sistemini başlat
  initLanguage();

  // Yükleme animasyonu
  const loader = document.querySelector('.loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.style.overflow = 'visible';
      initAnimations();
    }, 1000);
  } else {
    initAnimations();
  }

  // Temayı başlat
  initTheme();

  // Dil değiştirme butonlarına event listener ekle
  setupLanguageToggleEvents();
});

// Dil değiştirme olaylarını ayarla
function setupLanguageToggleEvents() {
  const languageElements = document.querySelectorAll('#current-flag, #current-flag-mobile, .language-toggle');
  
  languageElements.forEach(element => {
    element.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Language toggle clicked');
      toggleLanguage();
    });
  });
  
  console.log('Language toggle events set up for', languageElements.length, 'elements');
}

// Dil sistemini başlat
function initLanguage() {
  console.log('Initializing language system with:', currentLanguage);
  updateLanguage(currentLanguage);
}

const turkeyFlagSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
    <path fill="#e30a17" d="M0 0h640v480H0z"/>
    <circle cx="230" cy="240" r="100" fill="#fff"/>
    <circle cx="250" cy="240" r="80" fill="#e30a17"/>
    <path fill="#fff" d="M320 240l49 15.2-30.3-41.6V267l30.3-41.6z"/>
  </svg>
`;

const ukFlagSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30">
    <clipPath id="s">
      <path d="M0,0 v30 h60 v-30 z"/>
    </clipPath>
    <clipPath id="t">
      <path d="M30,15 h30 v15 z v-30 h-30 z M0,0 v15 h30 v-15 z"/>
    </clipPath>
    <g clip-path="url(#s)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#t)" stroke="#C8102E" stroke-width="4"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/>
    </g>
  </svg>
`;

// Dil değiştir
function toggleLanguage() {
  if (!translationsLoaded) {
    console.warn('Translations not loaded yet');
    return;
  }

  const newLanguage = currentLanguage === 'tr' ? 'en' : 'tr';
  if (currentLanguage === "tr") {
    document.documentElement.lang = "en";
    document.getElementById("language-tooltip-text").innerText = "English";
    document.getElementById("mobile-language-text").innerText = "English";
    document.getElementById("current-flag").innerHTML = ukFlagSvg;
    document.getElementById("current-flag-mobile").innerHTML = ukFlagSvg;
  } else {
    document.documentElement.lang = "tr";
    document.getElementById("language-tooltip-text").innerText = "Türkçe";
    document.getElementById("mobile-language-text").innerText = "Türkçe";
    document.getElementById("current-flag").innerHTML = turkeyFlagSvg;
    document.getElementById("current-flag-mobile").innerHTML = turkeyFlagSvg;
  }

  currentLanguage = newLanguage;
  localStorage.setItem('language', currentLanguage);
  updateLanguage(currentLanguage);
}


// Dili güncelle
function updateLanguage(lang) {
  console.log('Updating language to:', lang);
  
  if (!translationsLoaded || !translations[lang]) {
    console.error('Translations not available for language:', lang);
    return;
  }

  // Bayrak resimlerini güncelle
  updateFlags(lang);
  
  // Tooltip ve mobil metinleri güncelle
  updateLanguageLabels(lang);

  // Çevirilebilir elementleri güncelle  
  updateTranslatableElements(lang);

  // Placeholder'ları güncelle
  updatePlaceholders(lang);

  // HTML lang attribute güncelle
  document.documentElement.lang = lang;
  
  // Sayfa başlığını güncelle
  updatePageTitle(lang);
  
  console.log('Language updated to:', lang);
}

function updateFlags(lang) {
  const desktopFlag = document.getElementById('current-flag');
  const mobileFlag = document.getElementById('current-flag-mobile');
  
  if (desktopFlag && languageConfig[lang]) {
    desktopFlag.src = languageConfig[lang].flag;
    desktopFlag.alt = languageConfig[lang].name;
  }
  
  if (mobileFlag && languageConfig[lang]) {
    mobileFlag.src = languageConfig[lang].flag;
    mobileFlag.alt = languageConfig[lang].name;
  }
}

function updateLanguageLabels(lang) {
  const tooltipText = document.getElementById('language-tooltip-text');
  const mobileLanguageText = document.getElementById('mobile-language-text');
  
  if (tooltipText && languageConfig[lang]) {
    tooltipText.textContent = languageConfig[lang].name;
  }
  
  if (mobileLanguageText && languageConfig[lang]) {
    mobileLanguageText.textContent = languageConfig[lang].name;
  }
}

function updateTranslatableElements(lang) {
  const elements = document.querySelectorAll('[data-translate]');
  console.log('Found', elements.length, 'translatable elements');
  
  elements.forEach(element => {
    const key = element.getAttribute('data-translate');
    if (translations[lang] && translations[lang][key]) {
      element.textContent = translations[lang][key];
      console.log('Translated:', key, '->', translations[lang][key]);
    } else {
      console.warn('Translation missing for key:', key, 'in language:', lang);
    }
  });
}

function updatePlaceholders(lang) {
  const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
  
  placeholderElements.forEach(element => {
    const key = element.getAttribute('data-translate-placeholder');
    if (translations[lang] && translations[lang][key]) {
      element.placeholder = translations[lang][key];
    }
  });
}

function updatePageTitle(lang) {
  if (lang === 'tr') {
    document.title = 'Yusuf Değerli | Flutter Geliştirici & UI/UX Tasarımcı';
  } else {
    document.title = 'Yusuf Değerli | Flutter Developer & UI/UX Designer';
  }
}

// Initialize animations
function initAnimations() {
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
      }
    });
  }, options);

  sections.forEach(section => {
    section.classList.add("opacity-0", "translate-y-4", "transition-all", "duration-700");
    observer.observe(section);
  });
}

// Mobil menü toggle
function toggleMobileMenu() {
  const mobileMenu = document.querySelector('.mobile-menu');
  const menuButton = document.querySelector('.menu-button');

  mobileMenu.classList.toggle('active');
  menuButton.classList.toggle('active');

  document.body.classList.toggle('menu-open');

  if (mobileMenu.classList.contains('active')) {
    mobileMenu.style.height = 'calc(100vh - 4rem)';
  } else {
    mobileMenu.style.height = '0';
  }
}

// Dark/Light mode toggle
function toggleDarkMode() {
  const toggle = document.querySelector('.dark-mode-toggle');
  toggle.classList.toggle('active');
  document.body.classList.toggle('light-mode');

  const isDarkMode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  localStorage.setItem('theme', isDarkMode);
}

// Initialize theme from stored preference
function initTheme() {
  const storedTheme = localStorage.getItem('theme');

  if (storedTheme === 'light') {
    document.body.classList.add('light-mode');
    document.querySelector('.dark-mode-toggle')?.classList.add('active');
  }
}

// Form submission handler
function submitContactForm(event) {
  event.preventDefault();

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const messageInput = document.getElementById('message');
  const submitButton = document.querySelector('.submit-btn');
  const form = document.getElementById('contact-form');

  let isValid = true;

  if (!nameInput.value.trim()) {
    markInvalid(nameInput, translations[currentLanguage]['form.name_error'] || 'İsim gerekli');
    isValid = false;
  } else {
    markValid(nameInput);
  }

  if (!emailInput.value.trim() || !isValidEmail(emailInput.value)) {
    markInvalid(emailInput, translations[currentLanguage]['form.email_error'] || 'Geçerli bir e-posta giriniz');
    isValid = false;
  } else {
    markValid(emailInput);
  }

  if (!messageInput.value.trim()) {
    markInvalid(messageInput, translations[currentLanguage]['form.message_error'] || 'Mesaj gerekli');
    isValid = false;
  } else {
    markValid(messageInput);
  }

  if (isValid) {
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2"></i>${translations[currentLanguage]['form.sending'] || 'Gönderiliyor...'}`;

    if (window.emailjs) {
      const templateParams = {
        from_name: nameInput.value.trim(),
        from_email: emailInput.value.trim(),
        message: messageInput.value.trim(),
        to_email: 'yusufdgrl72@gmail.com'
      };

      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
        .then(function(response) {
          console.log('SUCCESS!', response.status, response.text);
          form.reset();
          submitButton.disabled = false;
          submitButton.innerHTML = `${translations[currentLanguage]['form.send'] || 'Gönder'} <i class="ri-send-plane-fill ml-2"></i>`;
          showMessage(translations[currentLanguage]['form.success_message'] || 'Mesajınız başarıyla gönderildi! Teşekkürler.', 'success');
        })
        .catch(function(error) {
          console.log('FAILED...', error);
          submitButton.disabled = false;
          submitButton.innerHTML = `${translations[currentLanguage]['form.send'] || 'Gönder'} <i class="ri-send-plane-fill ml-2"></i>`;
          showMessage(translations[currentLanguage]['form.error_message'] || 'Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.', 'error');
        });
    } else {
      setTimeout(() => {
        form.reset();
        submitButton.disabled = false;
        submitButton.innerHTML = `${translations[currentLanguage]['form.send'] || 'Gönder'} <i class="ri-send-plane-fill ml-2"></i>`;
        showMessage(translations[currentLanguage]['form.emailjs_error'] || 'EmailJS yüklenemedi. Lütfen sayfayı yenileyin.', 'error');
      }, 1500);
    }
  }
}

// Helper functions
function isValidEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

function showMessage(message, type = 'success') {
  const form = document.getElementById('contact-form');
  
  const existingMessage = form.querySelector('.form-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `form-message ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white p-4 rounded mt-4 transition-all duration-300`;
  messageDiv.innerHTML = `
    <div class="flex items-center">
      <i class="ri-${type === 'success' ? 'check-line' : 'error-warning-line'} mr-2"></i>
      <span>${message}</span>
    </div>
  `;
  
  form.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

function markInvalid(input, message) {
  input.classList.add('border-red-500');
  input.classList.remove('border-green-500');

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

  const errorElement = input.parentElement.querySelector('.error-message');
  if (errorElement) {
    errorElement.remove();
  }
}

// Quick contact form handler
function submitQuickContact(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const name = formData.get('name');
  const phone = formData.get('phone');
  
  if (!name.trim() || !phone.trim()) {
    alert(translations[currentLanguage]['form.quick_contact_error'] || 'Lütfen tüm alanları doldurun.');
    return;
  }
  
  const button = form.querySelector('button');
  const originalText = button.innerHTML;
  
  button.disabled = true;
  button.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2"></i>${translations[currentLanguage]['form.sending'] || 'Gönderiliyor...'}`;
  
  if (window.emailjs) {
    const templateParams = {
      from_name: name.trim(),
      from_phone: phone.trim(),
      message: `${name} adlı kişi hızlı iletişim formu ile sizi aramak istiyor. Telefon: ${phone}`,
      to_email: 'yusufdgrl72@gmail.com',
      subject: 'Hızlı İletişim Talebi'
    };
    
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
      .then(function(response) {
        console.log('Quick contact SUCCESS!', response.status, response.text);
        form.reset();
        button.disabled = false;
        button.innerHTML = originalText;
        alert(translations[currentLanguage]['form.quick_contact_success'] || 'Talebiniz alındı! En kısa sürede size dönüş yapacağım.');
      })
      .catch(function(error) {
        console.log('Quick contact FAILED...', error);
        button.disabled = false;
        button.innerHTML = originalText;
        alert(translations[currentLanguage]['form.quick_contact_error_message'] || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      });
  } else {
    setTimeout(() => {
      form.reset();
      button.disabled = false;
      button.innerHTML = originalText;
      alert(translations[currentLanguage]['form.emailjs_error'] || 'EmailJS yüklenemedi. Lütfen sayfayı yenileyin.');
    }, 1500);
  }
}
