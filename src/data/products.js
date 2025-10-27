export const categories = [
  {
    id: "all",
    name: "Tümü",
    icon: "☕",
  },
  {
    id: "beans",
    name: "Kahve Çekirdekleri",
    icon: "🫘",
    description:
      "Dünyanın dört bir yanından özenle seçilmiş kahve çekirdekleri",
  },
  {
    id: "ground",
    name: "Çekilmiş Kahve",
    icon: "🌰",
    description: "Taze çekilmiş, hazır demlenmeye hazır kahveler",
  },
  {
    id: "espresso",
    name: "Espresso",
    icon: "☕",
    description: "Yoğun ve aromatik espresso karışımları",
  },
  {
    id: "filter",
    name: "Filtre Kahve",
    icon: "🫗",
    description: "Hafif ve dengeli filtre kahve çeşitleri",
  },
  {
    id: "turkish",
    name: "Türk Kahvesi",
    icon: "🇹🇷",
    description: "Geleneksel Türk kahvesi aromaları",
  },
  {
    id: "equipment",
    name: "Ekipmanlar",
    icon: "⚙️",
    description: "Profesyonel kahve yapım ekipmanları",
  },
];

export const products = [
  // Kahve Çekirdekleri
  {
    id: 1,
    name: "Ethiopia Yirgacheffe",
    category: "beans",
    price: 285,
    image:
      "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&auto=format&fit=crop",
    origin: "Etiyopya",
    roast: "Light",
    notes: ["Çiçeksi", "Narenciye", "Bergamot"],
    description:
      "Etiyopyanın en prestijli bölgesinden, çiçeksi ve narenciye notalarıyla öne çıkan özel kahve.",
    rating: 4.9,
    inStock: true,
  },
  {
    id: 2,
    name: "Colombian Supremo",
    category: "beans",
    price: 245,
    image:
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&auto=format&fit=crop",
    origin: "Kolombiya",
    roast: "Medium",
    notes: ["Karamel", "Fındık", "Kakao"],
    description:
      "Kolombiya'nın en kaliteli kahve çekirdekleri, dengeli ve yumuşak bir profile sahip.",
    rating: 4.8,
    inStock: true,
  },
  {
    id: 3,
    name: "Brazil Santos",
    category: "beans",
    price: 195,
    image:
      "https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=800&auto=format&fit=crop",
    origin: "Brezilya",
    roast: "Medium-Dark",
    notes: ["Çikolata", "Yer Fıstığı", "Tatlı"],
    description:
      "Brezilyanın klasik aroması, çikolata ve kuruyemiş notalarıyla zengin bir tat.",
    rating: 4.7,
    inStock: true,
  },
  {
    id: 4,
    name: "Kenya AA",
    category: "beans",
    price: 295,
    image:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop",
    origin: "Kenya",
    roast: "Light-Medium",
    notes: ["Böğürtlen", "Kırmızı Üzüm", "Limon"],
    description:
      "Kenyanın en kaliteli AA grade kahvesi, parlak asitlik ve meyve notalarıyla.",
    rating: 4.9,
    inStock: true,
  },
  {
    id: 5,
    name: "Sumatra Mandheling",
    category: "beans",
    price: 265,
    image: "/assets/sumatra_mandheling.jpg",
    origin: "Endonezya",
    roast: "Dark",
    notes: ["Toprak", "Baharat", "Çikolata"],
    description:
      "Sumatranın derin ve karmaşık aromaları, düşük asiditeli zengin bir kahve.",
    rating: 4.6,
    inStock: true,
  },
  {
    id: 6,
    name: "Guatemala Antigua",
    category: "beans",
    price: 275,
    image: "/assets/guatemala_antigua.jpg",
    origin: "Guatemala",
    roast: "Medium",
    notes: ["Kakao", "Badem", "Karamel"],
    description:
      "Volkanik topraklarda yetişen, dengeli ve aromatik bir kahve deneyimi.",
    rating: 4.8,
    inStock: true,
  },

  // Çekilmiş Kahve
  {
    id: 7,
    name: "Premium Espresso Blend",
    category: "ground",
    price: 225,
    image:
      "https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=800&auto=format&fit=crop",
    origin: "Karışım",
    roast: "Medium-Dark",
    notes: ["Bitter Çikolata", "Karamel", "Badem"],
    description:
      "Mükemmel espresso için özel harmanlanmış, taze çekilmiş kahve.",
    rating: 4.8,
    inStock: true,
  },
  {
    id: 8,
    name: "Filtre Kahve Karışımı",
    category: "ground",
    price: 185,
    image: "/assets/filter_mix.jpg",
    origin: "Karışım",
    roast: "Light-Medium",
    notes: ["Çiçeksi", "Narenciye", "Bal"],
    description: "V60, Chemex ve French Press için ideal çekilmiş kahve.",
    rating: 4.7,
    inStock: true,
  },
  {
    id: 9,
    name: "Organik Türk Kahvesi",
    category: "ground",
    price: 165,
    image: "/assets/turkish_coffee.jpg",
    origin: "Türkiye",
    roast: "Dark",
    notes: ["Yoğun", "Baharat", "Kakao"],
    description:
      "Organik çekirdeklerden özel olarak çekilmiş, geleneksel Türk kahvesi.",
    rating: 4.9,
    inStock: true,
  },

  // Espresso
  {
    id: 10,
    name: "Italian Roast Espresso",
    category: "espresso",
    price: 235,
    image:
      "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop",
    origin: "İtalya Tarzı",
    roast: "Dark",
    notes: ["Bitter Çikolata", "Kavrulmuş", "Kremsi"],
    description: "İtalyan espresso geleneğine sadık, koyu kavrulmuş karışım.",
    rating: 4.8,
    inStock: true,
  },
  {
    id: 11,
    name: "Single Origin Espresso",
    category: "espresso",
    price: 285,
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop",
    origin: "Etiyopya",
    roast: "Medium",
    notes: ["Çiçeksi", "Çikolata", "Meyve"],
    description: "Tek origin özel espresso, karmaşık aroması ile.",
    rating: 4.9,
    inStock: true,
  },

  // Filtre Kahve
  {
    id: 12,
    name: "Light Roast Blend",
    category: "filter",
    price: 215,
    image: "/assets/light_roast_blend.jpg",
    origin: "Karışım",
    roast: "Light",
    notes: ["Parlak", "Meyvemsi", "Çiçeksi"],
    description: "Hafif kavrulmuş, parlak asitli filtre kahve karışımı.",
    rating: 4.7,
    inStock: true,
  },
  {
    id: 13,
    name: "Pour Over Special",
    category: "filter",
    price: 245,
    image:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop",
    origin: "Karışım",
    roast: "Light-Medium",
    notes: ["Narenciye", "Çay", "Jasmine"],
    description: "Pour over metodlar için optimize edilmiş özel blend.",
    rating: 4.8,
    inStock: true,
  },

  // Türk Kahvesi
  {
    id: 14,
    name: "Osmanlı Kahvesi",
    category: "turkish",
    price: 175,
    image: "/assets/osmanli_kahvesi.jpg",
    origin: "Özel Karışım",
    roast: "Medium-Dark",
    notes: ["Damla Sakızlı", "Baharat", "Yoğun"],
    description: "Damla sakızı aromalı, geleneksel Osmanlı kahvesi.",
    rating: 4.9,
    inStock: true,
  },
  {
    id: 15,
    name: "Menengiç Kahvesi",
    category: "turkish",
    price: 155,
    image: "/assets/menengic_kahvesi.jpg",
    origin: "Türkiye",
    roast: "Medium",
    notes: ["Çam Fıstığı", "Fındık", "Hafif Tatlı"],
    description:
      "Güneydoğu Anadolunun geleneksel içeceği, kafeinsiz alternatif.",
    rating: 4.6,
    inStock: true,
  },
  {
    id: 16,
    name: "Dibek Kahvesi",
    category: "turkish",
    price: 165,
    image: "/assets/dibek_kahvesi.jpg",
    origin: "Mardin",
    roast: "Traditional",
    notes: ["Kremsi", "Baharat", "Yoğun"],
    description:
      "Geleneksel dibekte dövülerek hazırlanan, kremsi yapısıyla özel kahve.",
    rating: 4.8,
    inStock: true,
  },

  // Ekipmanlar
  {
    id: 17,
    name: "Profesyonel French Press",
    category: "equipment",
    price: 445,
    image:
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&auto=format&fit=crop",
    origin: "Ekipman",
    description:
      "Borosilikat cam ve paslanmaz çelik, 1L kapasiteli French Press.",
    rating: 4.7,
    inStock: true,
  },
  {
    id: 18,
    name: "V60 Dripper Set",
    category: "equipment",
    price: 325,
    image:
      "https://images.unsplash.com/photo-1545665225-b23b99e4d45e?w=800&auto=format&fit=crop",
    origin: "Ekipman",
    description: "Hario V60 seramik dripper, filtre kağıdı ve ölçek seti.",
    rating: 4.9,
    inStock: true,
  },
  {
    id: 19,
    name: "Manuel Kahve Değirmeni",
    category: "equipment",
    price: 725,
    image:
      "https://images.unsplash.com/photo-1595434091143-b375ced5fe5c?w=800&auto=format&fit=crop",
    origin: "Ekipman",
    description:
      "Konilerde seramik öğütücülü, ayarlanabilir manuel kahve değirmeni.",
    rating: 4.8,
    inStock: true,
  },
  {
    id: 20,
    name: "Moka Pot Klasik",
    category: "equipment",
    price: 385,
    image: "/assets/moka_pot_klasik.jpg",
    origin: "Ekipman",
    description:
      "Alüminyum gövdeli, 6 fincan kapasiteli klasik İtalyan Moka Pot.",
    rating: 4.6,
    inStock: true,
  },
  {
    id: 21,
    name: "Dijital Terazi",
    category: "equipment",
    price: 295,
    image: "/assets/dijital_terazi.jpg",
    origin: "Ekipman",
    description: "0.1g hassasiyetli, zamanlayıcılı profesyonel kahve terazisi.",
    rating: 4.8,
    inStock: true,
  },
  {
    id: 22,
    name: "Gooseneck Kettle",
    category: "equipment",
    price: 565,
    image:
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop",
    origin: "Ekipman",
    description: "Sıcaklık kontrollü, paslanmaz çelik gooseneck kettle.",
    rating: 4.9,
    inStock: true,
  },
];

export const getProductsByCategory = (category) => {
  if (category === "all") {
    return products;
  }
  return products.filter((product) => product.category === category);
};

export const getFeaturedProducts = () => {
  return products.filter((product) => product.rating >= 4.8).slice(0, 6);
};
