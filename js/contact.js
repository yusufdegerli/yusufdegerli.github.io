// Contact: copy-to-clipboard for the email address and an EmailJS-backed form.
// EmailJS is loaded only when the visitor starts using the form.

const EMAILJS = {
  src: 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3.11.0/dist/email.min.js',
  serviceId: 'service_9g35zqx',
  templateId: 'template_8vb7g73',
  publicKey: 'ZuSt59qnLq6eXtV3z',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let emailjsPromise = null;

function loadEmailJS() {
  if (window.emailjs) return Promise.resolve(window.emailjs);
  if (!emailjsPromise) {
    emailjsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = EMAILJS.src;
      script.async = true;
      script.onload = () => {
        window.emailjs.init(EMAILJS.publicKey);
        resolve(window.emailjs);
      };
      script.onerror = () => {
        emailjsPromise = null;
        reject(new Error('EmailJS failed to load'));
      };
      document.head.append(script);
    });
  }
  return emailjsPromise;
}

export function initCopy(button, t) {
  const value = button.dataset.copy;
  const label = button.querySelector('[data-copy-label]');

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // clipboard blocked: the address is still visible and selectable
    }
    button.dataset.copied = 'true';
    label.textContent = t('js.copied', 'Copied');
    setTimeout(() => {
      button.dataset.copied = 'false';
      label.textContent = t('contact.copy', 'Copy');
    }, 1800);
  });
}

export function initContactForm(form, t) {
  const fields = {
    name: form.elements.namedItem('name'),
    email: form.elements.namedItem('email'),
    message: form.elements.namedItem('message'),
  };
  const honeypot = form.elements.namedItem('company');
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = submit.querySelector('[data-i18n]');

  form.addEventListener('focusin', () => loadEmailJS().catch(() => {}), { once: true });

  const rules = {
    name: (v) => (v.trim() ? '' : t('js.form.name_error', 'Please add your name.')),
    email: (v) => (EMAIL_PATTERN.test(v.trim()) ? '' : t('js.form.email_error', 'Please enter a valid email address.')),
    message: (v) =>
      v.trim().length >= 10 ? '' : t('js.form.message_error', 'A sentence or two helps me reply properly.'),
  };

  const showError = (name, message) => {
    const input = fields[name];
    const error = form.querySelector(`#${input.id}-error`);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    error.textContent = message;
  };

  const validate = () => {
    let firstInvalid = null;
    for (const [name, rule] of Object.entries(rules)) {
      const message = rule(fields[name].value);
      showError(name, message);
      if (message && !firstInvalid) firstInvalid = fields[name];
    }
    return firstInvalid;
  };

  Object.keys(fields).forEach((name) => {
    fields[name].addEventListener('blur', () => {
      if (fields[name].value) showError(name, rules[name](fields[name].value));
    });
  });

  const setStatus = (state, message) => {
    status.dataset.state = state;
    status.textContent = message;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (honeypot?.value) return;

    const invalid = validate();
    if (invalid) {
      invalid.focus();
      return;
    }

    submit.disabled = true;
    submitLabel.textContent = t('js.form.sending', 'Sending…');
    setStatus('', '');

    try {
      const emailjs = await loadEmailJS();
      await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
        from_name: fields.name.value.trim(),
        from_email: fields.email.value.trim(),
        message: fields.message.value.trim(),
        to_email: 'yusufdgrl72@gmail.com',
      });
      form.reset();
      Object.keys(fields).forEach((name) => fields[name].removeAttribute('aria-invalid'));
      setStatus('ok', t('js.form.success', 'Thanks — your message is on its way.'));
    } catch (error) {
      console.warn(error);
      setStatus('error', t('js.form.error', 'Something went wrong. Please email me directly instead.'));
    } finally {
      submit.disabled = false;
      submitLabel.textContent = t('form.send', 'Send message');
    }
  });
}
