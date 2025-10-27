import { useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Products from "./components/Products";
import About from "./components/About";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import "./App.css";

function App() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  return (
    <div className="app">
      <Header onSelectCategory={setSelectedCategory} />
      <Hero />
      <Products
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <About />
      <Contact />
      <Footer />
    </div>
  );
}

export default App;
