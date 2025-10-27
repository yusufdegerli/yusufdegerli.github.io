import { categories } from '../data/products'
import './Categories.css'

function Categories({ selectedCategory, onSelectCategory }) {
  return (
    <section className="categories" id="categories">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">☕ Kategoriler</span>
          <h2 className="section-title">Kahve Dünyamızı Keşfedin</h2>
          <p className="section-description">
            Çekirdekten ekipmana, her kahve severin ihtiyacı için özel seçenekler
          </p>
        </div>

        <div className="categories-grid">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`category-card ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => onSelectCategory(category.id)}
            >
              <div className="category-icon">{category.icon}</div>
              <h3 className="category-name">{category.name}</h3>
              {category.description && (
                <p className="category-description">{category.description}</p>
              )}
              <div className="category-arrow">→</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Categories

