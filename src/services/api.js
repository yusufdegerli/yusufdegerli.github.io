import { categories, products } from "../data/products";

/**
 * Get all categories
 */
export async function getCategories() {
  return Promise.resolve(categories);
}

/**
 * Get all products
 */
export async function getProducts(params = {}) {
  return Promise.resolve(products);
}

/**
 * Get products by category
 */
export async function getProductsByCategory(categoryId) {
  if (categoryId === "all") {
    return Promise.resolve(products);
  }

  const filteredProducts = products.filter(
    (product) => product.category === categoryId
  );
  return Promise.resolve(filteredProducts);
}

/**
 * Get single product
 */
export async function getProduct(productId) {
  const product = products.find((p) => p.id === parseInt(productId));
  return Promise.resolve(product || null);
}

/**
 * Get featured products
 */
export async function getFeaturedProducts() {
  const featuredProducts = products
    .filter((product) => product.rating >= 4.8)
    .slice(0, 6);
  return Promise.resolve(featuredProducts);
}

/**
 * Get in-stock products
 */
export async function getInStockProducts() {
  const inStockProducts = products.filter(
    (product) => product.inStock === true
  );
  return Promise.resolve(inStockProducts);
}
