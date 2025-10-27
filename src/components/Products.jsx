import { useState, useEffect, useRef } from "react";
import { getProductsByCategory } from "../services/api";
import { categories } from "../data/products";
import "./Products.css";

function Products({ selectedCategory, onSelectCategory }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const dropdownRef = useRef(null);

  // Fetch products from API
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);
        const data = await getProductsByCategory(selectedCategory);
        // API paginated response döndürüyor, results array'ini al
        setProducts(data.results || data);
      } catch (err) {
        setError("Ürünler yüklenirken bir hata oluştu.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [selectedCategory]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getRoastLevel = (roast) => {
    const levels = {
      Light: { bars: 1, color: "#D4A574" },
      "Light-Medium": { bars: 2, color: "#B8936D" },
      Medium: { bars: 3, color: "#8B6F47" },
      "Medium-Dark": { bars: 4, color: "#6F4E37" },
      Dark: { bars: 5, color: "#5A3D2B" },
      Traditional: { bars: 3, color: "#8B6F47" },
    };
    return levels[roast] || levels["Medium"];
  };

  const selectedCategoryData = categories.find(
    (cat) => cat.id === selectedCategory
  );

  // Loading state
  if (loading) {
    return (
      <section className="products" id="products">
        <div className="container">
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div className="loading-spinner"></div>
            <p style={{ marginTop: "20px", color: "#666" }}>
              Ürünler yükleniyor...
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="products" id="products">
        <div className="container">
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ color: "#f44336", fontSize: "1.1rem" }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "20px",
                padding: "12px 24px",
                background: "#6F4E37",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="products" id="products">
      <div className="container">
        <div className="products-header">
          <div>
            <h2 className="products-title">
              {selectedCategory === "all"
                ? "Özenle Seçilmiş Ürünler"
                : selectedCategoryData?.name}
            </h2>
            <p className="products-count">
              <span className="count-number">{products.length}</span> muhteşem
              ürün sizi bekliyor
            </p>
          </div>

          <div className="view-controls">
            <button
              className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Grid görünümü"
            >
              <span>⊞</span>
              <span className="view-label">Grid</span>
            </button>
            <button
              className={`view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="Liste görünümü"
            >
              <span>☰</span>
              <span className="view-label">Liste</span>
            </button>
          </div>
        </div>

        <div className={`products-grid ${viewMode}`}>
          {products.map((product, index) => (
            <div
              key={product.id}
              className="product-card"
              onMouseEnter={() => setHoveredProduct(product.id)}
              onMouseLeave={() => setHoveredProduct(null)}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="product-image-wrapper">
                <div className="product-image">
                  <div className="gradient-overlay"></div>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="product-img"
                    loading="lazy"
                  />
                  <div className="sparkles">
                    <span className="sparkle">✨</span>
                    <span className="sparkle">✨</span>
                    <span className="sparkle">✨</span>
                  </div>
                </div>

                <div className="product-badges">
                  {product.inStock ? (
                    <span className="product-badge stock">
                      <span className="badge-dot"></span>
                      Stokta
                    </span>
                  ) : (
                    <span className="product-badge out-of-stock">Tükendi</span>
                  )}
                  {product.rating >= 4.8 && (
                    <span className="product-badge featured">⭐ Popüler</span>
                  )}
                </div>

                <div className="quick-actions">
                  <button className="quick-btn" title="Favorilere Ekle">
                    <span>❤️</span>
                  </button>
                  <button
                    className="quick-btn"
                    title="Hızlı Görünüm"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <span>👁️</span>
                  </button>
                  <button className="quick-btn" title="Karşılaştır">
                    <span>⚖️</span>
                  </button>
                </div>
              </div>

              <div className="product-info">
                <div className="product-header">
                  <div>
                    <h3 className="product-name">{product.name}</h3>
                    {product.origin && (
                      <p className="product-origin">
                        <span className="origin-icon">📍</span>
                        {product.origin}
                      </p>
                    )}
                  </div>
                  {product.rating && (
                    <div className="product-rating">
                      <div className="rating-stars">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`star ${
                              i < Math.floor(product.rating) ? "filled" : ""
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="rating-value">{product.rating}</span>
                    </div>
                  )}
                </div>

                {product.roast && (
                  <div className="roast-info">
                    <div className="roast-header">
                      <span className="roast-label">🔥 Kavurma Seviyesi</span>
                      <span className="roast-name">{product.roast}</span>
                    </div>
                    <div className="roast-meter">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`roast-bar ${
                            i < getRoastLevel(product.roast).bars
                              ? "active"
                              : ""
                          }`}
                          style={{
                            backgroundColor:
                              i < getRoastLevel(product.roast).bars
                                ? getRoastLevel(product.roast).color
                                : "#E8E8E8",
                          }}
                        ></div>
                      ))}
                    </div>
                  </div>
                )}

                {product.notes && product.notes.length > 0 && (
                  <div className="product-notes">
                    <div className="notes-tags">
                      {product.notes.slice(0, 3).map((note, index) => (
                        <span key={index} className="note-tag">
                          {note}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="product-description">
                  {product.description.length > 80
                    ? product.description.substring(0, 80) + "..."
                    : product.description}
                </p>

                <div className="product-footer">
                  <div className="product-price-wrapper">
                    <div className="product-price">
                      <span className="price-value">{product.price}₺</span>
                      {product.roast && (
                        <span className="price-unit">/ 250g</span>
                      )}
                    </div>
                    {product.roast && (
                      <div className="price-per-cup">
                        <span className="cup-icon">☕</span>
                        <span className="cup-price">
                          ~{Math.round(product.price / 15)}₺/fincan
                        </span>
                      </div>
                    )}
                  </div>
                  <a href="#contact" className="contact-btn-product">
                    <span className="contact-icon">📞</span>
                    <span className="btn-text">Bilgi Al</span>
                  </a>
                </div>
              </div>

              <div
                className={`product-shine ${
                  hoveredProduct === product.id ? "active" : ""
                }`}
              ></div>
            </div>
          ))}
        </div>

        {/* Product Detail Modal */}
        {selectedProduct && (
          <div
            className="modal-overlay"
            onClick={() => setSelectedProduct(null)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button
                className="modal-close"
                onClick={() => setSelectedProduct(null)}
              >
                ✕
              </button>

              <div className="modal-body">
                <div className="modal-image">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="modal-img"
                  />
                </div>

                <div className="modal-info">
                  <div className="modal-header">
                    <h2 className="modal-title">{selectedProduct.name}</h2>
                    {selectedProduct.rating && (
                      <div className="modal-rating">
                        <div className="rating-stars">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`star ${
                                i < Math.floor(selectedProduct.rating)
                                  ? "filled"
                                  : ""
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="rating-value">
                          {selectedProduct.rating}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedProduct.origin && (
                    <p className="modal-origin">
                      <span className="origin-icon">📍</span>
                      {selectedProduct.origin}
                    </p>
                  )}

                  <p className="modal-description">
                    {selectedProduct.description}
                  </p>

                  {selectedProduct.roast && (
                    <div className="modal-roast">
                      <h4>🔥 Kavurma Seviyesi</h4>
                      <div className="roast-info">
                        <span className="roast-name">
                          {selectedProduct.roast}
                        </span>
                        <div className="roast-meter">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`roast-bar ${
                                i < getRoastLevel(selectedProduct.roast).bars
                                  ? "active"
                                  : ""
                              }`}
                              style={{
                                backgroundColor:
                                  i < getRoastLevel(selectedProduct.roast).bars
                                    ? getRoastLevel(selectedProduct.roast).color
                                    : "#E8E8E8",
                              }}
                            ></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedProduct.notes &&
                    selectedProduct.notes.length > 0 && (
                      <div className="modal-notes">
                        <h4>🎭 Tat Notları</h4>
                        <div className="notes-tags">
                          {selectedProduct.notes.map((note, index) => (
                            <span key={index} className="note-tag">
                              {note}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="modal-footer">
                    <div className="modal-price">
                      <span className="price-label">Fiyat</span>
                      <div className="price-wrapper">
                        <span className="price-value">
                          {selectedProduct.price}₺
                        </span>
                        {selectedProduct.roast && (
                          <span className="price-unit">/ 250g</span>
                        )}
                      </div>
                    </div>
                    <a
                      href="#contact"
                      className="modal-contact-btn"
                      onClick={() => setSelectedProduct(null)}
                    >
                      <span>📞</span>
                      <span>İletişime Geç</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Products;
