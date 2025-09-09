// Modern Portfolio JavaScript

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
    flag: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAzMiAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjI0IiBmaWxsPSIjMDAyNDY2Ii8+CjxyZWN0IHdpZHRoPSIzMiIgaGVpZ2h0PSI2IiBmaWxsPSIjRkZGRkZGIi8+CjxyZWN0IHk9IjYiIHdpZHRoPSIzMiIgaGVpZ2h0PSI2IiBmaWxsPSIjRkZGRkZGIi8+CjxyZWN0IHk9IjEyIiB3aWR0aD0iMzIiIGhlaWdodD0iNiIgZmlsbD0iI0ZGRkZGRiIvPgo8cmVjdCB5PSIxOCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjYiIGZpbGw9IiNGRkZGRkYiLz4KPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjI0IiBmaWxsPSIjRkZGRkZGIi8+CjxzdiB4PSIwIiB5PSIwIiB3aWR0aD0iMTIiIGhlaWdodD0iMjQiIj4KPHN2ZyB4PSIxLjUiIHk9IjEuNSIgd2lkdGg9IjkiIGhlaWdodD0iMjEiPgo8cGF0aCBkPSJNMCAwTDkgMTEuNUwwIDIxVjBaIiBmaWxsPSIjRkZGRkZGIi8+CjxwYXRoIGQ9Ik0wIDBMMSAxLjVMMCAzVjBaIiBmaWxsPSIjMDAyNDY2Ii8+CjxwYXRoIGQ9Ik0wIDNMMSA0LjVMMCA2VjNaIiBmaWxsPSIjMDAyNDY2Ii8+CjxwYXRoIGQ9Ik0wIDZMMSA3LjVMMCA5VjZaIiBmaWxsPSIjMDAyNDY2Ii8+CjxwYXRoIGQ9Ik0wIDlMMSAxMC41TDAgMTJWOVoiIGZpbGw9IiMwMDI0NjYiLz4KPHN2ZyB4PSIwIiB5PSIxMiIgd2lkdGg9IjEiIGhlaWdodD0iOSI+CjxwYXRoIGQ9Ik0wIDBMMSAxLjVMMCAzVjBaIiBmaWxsPSIjMDAyNDY2Ii8+CjxwYXRoIGQ9Ik0wIDNMMSA0LjVMMCA2VjNaIiBmaWxsPSIjMDAyNDY2Ii8+CjxwYXRoIGQ9Ik0wIDZMMSA3LjVMMCA5VjZaIiBfiWxsPSIjMDAyNDY2Ii8+Cjwvc3ZnPgo8L3N2Zz4KPC9zdmc+Cjwvc3ZnPg==',
    name: 'English'
  }
};

let currentLanguage = localStorage.getItem('language') || 'tr';

// Sayfa yüklenme animasyonu
document.addEventListener("DOMContentLoaded", () => {
  // Initialize EmailJS
  if (window.emailjs) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  // Initialize language system
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

  // Initialize theme
  initTheme();

  // Add language toggle event listeners
  document.querySelectorAll('#current-flag, #current-flag-mobile').forEach(flag => {
    flag.addEventListener('click', toggleLanguage);
  });
});

// Language System Functions
async function initLanguage() {
  await i18next.init({
    lng: currentLanguage,
    resources: {
      tr: { translation: await (await fetch('tr.json')).json() },
      en: { translation: await (await fetch('en.json')).json() }
    }
  });
  updateLanguage(currentLanguage);
}

function toggleLanguage() {
  currentLanguage = currentLanguage === 'tr' ? 'en' : 'tr';
  localStorage.setItem('language', currentLanguage);
  updateLanguage(currentLanguage);
}

function updateLanguage(lang) {
  i18next.changeLanguage(lang, () => {
    // Update flag images
    const desktopFlag = document.getElementById('current-flag');
    const mobileFlag = document.getElementById('current-flag-mobile');
    const tooltipText = document.getElementById('language-tooltip-text');
    const mobileLanguageText = document.getElementById('mobile-language-text');
    
    if (desktopFlag) {
      desktopFlag.src = languageConfig[lang].flag;
      desktopFlag.alt = languageConfig[lang].name;
    }
    
    if (mobileFlag) {
      mobileFlag.src = languageConfig[lang].flag;
      mobileFlag.alt = languageConfig[lang].name;
    }
    
    if (tooltipText) {
      tooltipText.textContent = languageConfig[lang].name;
    }
    
    if (mobileLanguageText) {
      mobileLanguageText.textContent = i18next.t(`language.${lang}`);
    }

    // Update all translatable elements
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      element.textContent = i18next.t(key);
    });

    // Update placeholder texts
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
      const key = element.getAttribute('data-translate-placeholder');
      element.placeholder = i18next.t(key);
    });

    // Update HTML lang attribute
    document.documentElement.lang = lang;
  });
}

// Initialize animations
function initAnimations() {
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
    markInvalid(nameInput, i18next.t('form.name_error'));
    isValid = false;
  } else {
    markValid(nameInput);
  }

  if (!emailInput.value.trim() || !isValidEmail(emailInput.value)) {
    markInvalid(emailInput, i18next.t('form.email_error'));
    isValid = false;
  } else {
    markValid(emailInput);
  }

  if (!messageInput.value.trim()) {
    markInvalid(messageInput, i18next.t('form.message_error'));
    isValid = false;
  } else {
    markValid(messageInput);
  }

  if (isValid) {
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2"></i>${i18next.t('form.sending')}`;

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
          submitButton.innerHTML = `${i18next.t('form.send')} <i class="ri-send-plane-fill ml-2"></i>`;
          showMessage(i18next.t('form.success_message'), 'success');
        })
        .catch(function(error) {
          console.log('FAILED...', error);
          submitButton.disabled = false;
          submitButton.innerHTML = `${i18next.t('form.send')} <i class="ri-send-plane-fill ml-2"></i>`;
          showMessage(i18next.t('form.error_message'), 'error');
        });
    } else {
      setTimeout(() => {
        form.reset();
        submitButton.disabled = false;
        submitButton.innerHTML = `${i18next.t('form.send')} <i class="ri-send-plane-fill ml-2"></i>`;
        showMessage(i18next.t('form.emailjs_error'), 'error');
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
    alert(i18next.t('form.quick_contact_error'));
    return;
  }
  
  const button = form.querySelector('button');
  const originalText = button.innerHTML;
  
  button.disabled = true;
  button.innerHTML = `<i class="ri-loader-4-line animate-spin mr-2"></i>${i18next.t('form.sending')}`;
  
  if (window.emailjs) {
    const templateParams = {
      from_name: name.trim(),
      from_phone: phone.trim(),
      message: `${name} ${i18next.t('form.quick_contact_message')} ${phone}`,
      to_email: 'yusufdgrl72@gmail.com',
      subject: i18next.t('form.quick_contact_subject')
    };
    
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
      .then(function(response) {
        console.log('Quick contact SUCCESS!', response.status, response.text);
        form.reset();
        button.disabled = false;
        button.innerHTML = originalText;
        alert(i18next.t('form.quick_contact_success'));
      })
      .catch(function(error) {
        console.log('Quick contact FAILED...', error);
        button.disabled = false;
        button.innerHTML = originalText;
        alert(i18next.t('form.quick_contact_error_message'));
      });
  } else {
    setTimeout(() => {
      form.reset();
      button.disabled = false;
      button.innerHTML = originalText;
      alert(i18next.t('form.emailjs_error'));
    }, 1500);
  }
}
