import { useState } from "react";
import "./Contact.css";

function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });


  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Form gönderme işlemi burada yapılabilir
    console.log("Form gönderildi:", formData);
    setSubmitted(true);

    // 3 saniye sonra formu sıfırla
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    }, 3000);
  };

  return (
    <section className="contact" id="contact">
      <div className="container">
        <div className="contact-content">
          <div className="contact-info">
            <span className="section-badge">📧 İletişim</span>
            <h2 className="section-title">Bizimle İletişime Geçin</h2>
            <p className="contact-description">
              Sorularınız, önerileriniz veya özel sipariş talepleriniz için bize
              ulaşabilirsiniz. Size en kısa sürede geri dönüş yapacağız.
            </p>

            <div className="contact-details">
              <div className="contact-detail-item">
                <div className="detail-icon">📍</div>
                <div className="detail-content">
                  <h4 className="detail-title">Adres</h4>
                  <p className="detail-text">
                    Nişantaşı Mahallesi, Kahve Sokak No:42
                    <br />
                    Şişli, İstanbul 34365
                  </p>
                </div>
              </div>

              <div className="contact-detail-item">
                <div className="detail-icon">📧</div>
                <div className="detail-content">
                  <h4 className="detail-title">E-posta</h4>
                  <p className="detail-text">
                    hh.34foodcompany@gmail.com
                  </p>
                </div>
              </div>

              <div className="contact-detail-item">
                <div className="detail-icon">📱</div>
                <div className="detail-content">
                  <h4 className="detail-title">Telefon</h4>
                  <p className="detail-text">0 536 417 06 34</p>
                </div>
              </div>

              <div className="contact-detail-item">
                <div className="detail-icon">🕐</div>
                <div className="detail-content">
                  <h4 className="detail-title">Çalışma Saatleri</h4>
                  <p className="detail-text">
                    Pazartesi - Cuma: 09:00 - 18:00
                    <br />
                    Cumartesi: 10:00 - 16:00
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-form-wrapper">
            <div className="form-header">
              <h3 className="form-title">Mesaj Gönderin</h3>
              <p className="form-subtitle">
                Tüm alanları doldurarak bize ulaşabilirsiniz
              </p>
            </div>

            {submitted ? (
              <div className="success-message">
                <div className="success-icon">✓</div>
                <h4>Mesajınız Gönderildi!</h4>
                <p>En kısa sürede size geri dönüş yapacağız.</p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name" className="form-label">
                      <span className="label-icon">👤</span>
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="form-input"
                      placeholder="Adınız ve soyadınız"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                    <label htmlFor="email" className="form-label">
                      <span className="label-icon">📧</span>
                      E-posta *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      className="form-input"
                      placeholder="ornek@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="phone" className="form-label">
                      <span className="label-icon">📱</span>
                      Telefon
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className="form-input"
                      placeholder="+90 (555) 123 45 67"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="subject" className="form-label">
                      <span className="label-icon">📋</span>
                      Konu *
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      className="form-input form-select"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Konu seçiniz</option>
                      <option value="genel">Genel Bilgi</option>
                      <option value="urun">Ürün Hakkında</option>
                      <option value="siparis">Sipariş & Kargo</option>
                      <option value="kurumsal">Kurumsal Satış</option>
                      <option value="isbirligi">İşbirliği</option>
                      <option value="sikayet">Öneri & Şikayet</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="message" className="form-label">
                    <span className="label-icon">💬</span>
                    Mesajınız *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    className="form-input form-textarea"
                    placeholder="Mesajınızı buraya yazınız..."
                    rows="6"
                    value={formData.message}
                    onChange={handleChange}
                    required
                  ></textarea>
                </div>

                <button type="submit" className="form-submit-btn">
                  <span>Mesajı Gönder</span>
                  <span className="btn-icon">📤</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Contact;
