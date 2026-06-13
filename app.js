let products = [];
let catalogSettings = {
  default_registered_discount_percent: 3,
  free_delivery_threshold_kgs: 10000,
  manager_whatsapp: "+996706771103",
};

const state = {
  category: "Все",
  query: "",
  label: "",
  favoriteOnly: false,
  maxPrice: 0,
  sort: "featured",
  visibleLimit: 60,
  cart: new Map(),
  customer: loadCustomer(),
};

const productGrid = document.querySelector("#productGrid");
const categoryFilter = document.querySelector("#categoryFilter");
const searchInput = document.querySelector("#searchInput");
const headerSearchInput = document.querySelector("#headerSearchInput");
const quickCategoryGrid = document.querySelector("#quickCategoryGrid");
const catalogDirectory = document.querySelector("#catalogDirectory");
const recentlyViewedSection = document.querySelector("#recentlyViewed");
const recentlyViewedRow = document.querySelector("#recentlyViewedRow");
const priceRange = document.querySelector("#priceRange");
const priceOutput = document.querySelector("#priceOutput");
const sortSelect = document.querySelector("#sortSelect");
const favoriteFilterButton = document.querySelector("#favoriteFilter");
const loadMore = document.querySelector("#loadMore");
const resultCount = document.querySelector("#resultCount");
const cartDrawer = document.querySelector("#cartDrawer");
const cartItems = document.querySelector("#cartItems");
const cartCount = document.querySelector("#cartCount");
const cartTotal = document.querySelector("#cartTotal");
const cartDeliveryNote = document.querySelector("#cartDeliveryNote");
const cartDeliveryProgress = document.querySelector("#cartDeliveryProgress");
const cartDeliveryProgressBar = document.querySelector("#cartDeliveryProgressBar");
const formStatus = document.querySelector("#formStatus");
const productModal = document.querySelector("#productModal");
const productModalContent = document.querySelector("#productModalContent");
const customerForm = document.querySelector("#customerForm");
const customerCardTitle = document.querySelector("#customerCardTitle");
const customerCardText = document.querySelector("#customerCardText");
const clearCustomerButton = document.querySelector("#clearCustomer");
const siteHeader = document.querySelector(".site-header");
const toggleSearchButton = document.querySelector("#toggleSearch");
const toggleMenuButton = document.querySelector("#toggleMenu");
const categoryMenu = document.querySelector("#categoryMenu");
const hero = document.querySelector(".hero");
const heroTrack = document.querySelector("#heroTrack");
const heroDots = document.querySelector("#heroDots");
const heroPrevButton = document.querySelector("#heroPrev");
const heroNextButton = document.querySelector("#heroNext");
let activeZoomImage = null;

const recentlyViewedStorageKey = "globalMarketRecentlyViewed";
let recentlyViewedIds = loadRecentlyViewed();
const favoritesStorageKey = "globalMarketFavorites";
let favoriteIds = new Set(loadFavorites());

const promoBanners = [
  {
    image: "assets/hero-green-wide-v1.png",
    alt: "Теплая прачечная с растениями и товарами для дома",
    eyebrow: "Для дома",
    title: "Бытовая химия и уход",
    href: "#catalog",
  },
  {
    image: "assets/hero-promo-downy-dark.jpg",
    alt: "Ополаскиватели Downy в темной синей прачечной",
    eyebrow: "Downy",
    title: "Свежесть для белья",
    href: "#catalog",
  },
  {
    image: "assets/hero-promo-clear-dark.jpg",
    alt: "Шампуни Clear Men в темной синей ванной",
    eyebrow: "Уход за волосами",
    title: "Clear Men",
    href: "#catalog",
  },
  {
    image: "assets/hero-promo-dalli-autumn.jpg",
    alt: "Средства Dalli на осеннем фоне",
    eyebrow: "Dalli",
    title: "Стирка для всей семьи",
    href: "#catalog",
  },
  {
    image: "assets/hero-promo-dash-green.jpg",
    alt: "Средства Dash на зеленом тропическом фоне",
    eyebrow: "Dash",
    title: "Свежая стирка",
    href: "#catalog",
  },
  {
    image: "assets/hero-promo-pink-stuff.jpg",
    alt: "Средства The Pink Stuff на розовом фоне",
    eyebrow: "The Pink Stuff",
    title: "Чистота и блеск",
    href: "#catalog",
  },
];

const quickCategoryCards = [
  { title: "Стирка", category: "Стирка и уход за бельем", image: "assets/category-cards/category-laundry.jpg" },
  { title: "Чистка", category: "Уборка и чистота", image: "assets/category-cards/category-cleaning.jpg" },
  { title: "Волосы", category: "Уход за волосами", image: "assets/category-cards/category-hair.jpg" },
  { title: "Тело", category: "Уход за телом", image: "assets/category-cards/category-body.jpg" },
  { title: "Кремы", category: "Уход за телом", query: "крем", image: "assets/category-cards/category-creams.jpg" },
  { title: "Зубы", category: "Зубная гигиена", image: "assets/category-cards/category-oral.jpg" },
  { title: "Бритье", category: "Бритье", image: "assets/category-cards/category-shaving.jpg" },
  { title: "Дезодоранты", category: "Дезодоранты", image: "assets/category-cards/category-deodorants.jpg" },
  { title: "Парфюм", category: "Парфюм 5 мл", image: "assets/category-cards/category-perfume.jpg" },
  { title: "Еда", category: "Продукты", image: "assets/category-cards/category-food.jpg" },
  { title: "Германия", category: "Товары из Германии", image: "assets/category-cards/category-germany.jpg" },
  { title: "Дом", category: "Разное", image: "assets/category-cards/category-home.jpg" },
];

let activeHeroIndex = 0;
let heroTimer = null;
let heroPointerStartX = 0;
let heroPointerStartY = 0;
let heroPointerId = null;
let heroSwipeMoved = false;
let suppressHeroClick = false;
let menuCategories = [];

const currency = new Intl.NumberFormat("ru-RU");
const decimalCurrency = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fallbackImages = [
  { keys: ["капсулы"], image: "assets/placeholders/laundry-capsules.svg" },
  { keys: ["стиральный порошок", "порошок"], image: "assets/placeholders/laundry-powder.svg" },
  { keys: ["кондиционер для белья", "концентрированный кондиционер"], image: "assets/placeholders/fabric-softener.svg" },
  { keys: ["гель для стирки", "стирка и уход за бельем"], image: "assets/placeholders/laundry-gel.svg" },
  { keys: ["мужской шампунь", "шампунь"], image: "assets/placeholders/shampoo.svg" },
  { keys: ["кондиционер для волос"], image: "assets/placeholders/conditioner.svg" },
  { keys: ["гель для душа"], image: "assets/placeholders/shower-gel.svg" },
  { keys: ["мыло"], image: "assets/placeholders/soap.svg" },
  { keys: ["дезодорант-стик", "стик"], image: "assets/placeholders/deodorant-roll.svg" },
  { keys: ["роликовый дезодорант", "дезодорант", "дезодоранты"], image: "assets/placeholders/deodorant-spray.svg" },
  { keys: ["сменные кассеты", "бритвенные станки", "средство для бритья", "гель для бритья", "бритье"], image: "assets/placeholders/shaving.svg" },
  { keys: ["зубная паста", "зубная гигиена"], image: "assets/placeholders/toothpaste.svg" },
  { keys: ["средство для посуды"], image: "assets/placeholders/dish.svg" },
  { keys: ["чистящее средство", "уборка и чистота"], image: "assets/placeholders/cleaning.svg" },
  { keys: ["молотый кофе", "продукты"], image: "assets/placeholders/food.svg" },
];

function formatPrice(value) {
  return `${currency.format(Math.round(value))} сом`;
}

function formatWholesale(value) {
  return `${decimalCurrency.format(Number(value))} сом`;
}

function renderHeroBanners() {
  if (!heroTrack || !heroDots || !promoBanners.length) return;
  heroTrack.innerHTML = promoBanners
    .map(
      (banner) => `
        <article class="hero-slide">
          <img class="hero-image" src="${escapeHtml(banner.image)}" alt="${escapeHtml(banner.alt)}" />
          <a class="hero-content" href="${escapeHtml(banner.href)}">
            <p class="eyebrow">${escapeHtml(banner.eyebrow)}</p>
            <h1>${escapeHtml(banner.title)}</h1>
          </a>
        </article>
      `,
    )
    .join("");
  heroDots.innerHTML = promoBanners
    .map(
      (_, index) => `
        <button class="hero-dot ${index === activeHeroIndex ? "active" : ""}" type="button" data-hero-slide="${index}" aria-label="Показать баннер ${index + 1}"></button>
      `,
    )
    .join("");
  updateHeroBanner();
}

function updateHeroBanner() {
  if (!heroTrack || !heroDots) return;
  heroTrack.style.transform = `translateX(-${activeHeroIndex * 100}%)`;
  heroDots.querySelectorAll(".hero-dot").forEach((dot, index) => {
    const isActive = index === activeHeroIndex;
    dot.classList.toggle("active", isActive);
    dot.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function showHeroBanner(index) {
  activeHeroIndex = (index + promoBanners.length) % promoBanners.length;
  updateHeroBanner();
}

function startHeroRotation() {
  if (promoBanners.length < 2) return;
  window.clearInterval(heroTimer);
  heroTimer = window.setInterval(() => {
    showHeroBanner(activeHeroIndex + 1);
  }, 5200);
}

function manuallyShowHeroBanner(index) {
  showHeroBanner(index);
  startHeroRotation();
}

function isRegisteredCustomer() {
  return Boolean(state.customer?.name && state.customer?.phone);
}

function productPrice(product) {
  return isRegisteredCustomer() ? product.registeredPriceKgs : product.retailPriceKgs;
}

function hasProductImage(product) {
  return Boolean(product.image || product.galleryImages?.length);
}

function fallbackImageFor(product) {
  const haystack = `${product.productType || ""} ${product.category || ""} ${product.title || ""}`.toLowerCase();
  return fallbackImages.find((item) => item.keys.some((key) => haystack.includes(key)))?.image || "assets/placeholders/generic.svg";
}

function productCardImage(product) {
  return product.image || fallbackImageFor(product);
}

function loadFavorites() {
  try {
    const ids = JSON.parse(localStorage.getItem(favoritesStorageKey) || "[]");
    if (Array.isArray(ids)) return ids.filter((id) => typeof id === "string").slice(0, 200);
  } catch {
    return [];
  }
  return [];
}

function saveFavorites() {
  localStorage.setItem(favoritesStorageKey, JSON.stringify([...favoriteIds]));
}

function isFavorite(productId) {
  return favoriteIds.has(productId);
}

function toggleFavorite(productId) {
  if (!productId) return;
  if (favoriteIds.has(productId)) {
    favoriteIds.delete(productId);
  } else {
    favoriteIds.add(productId);
  }
  saveFavorites();
  renderFavoriteFilter();
  renderProducts();
  renderRecentlyViewed();
}

function loadRecentlyViewed() {
  try {
    const ids = JSON.parse(localStorage.getItem(recentlyViewedStorageKey) || "[]");
    if (Array.isArray(ids)) return ids.filter((id) => typeof id === "string").slice(0, 20);
  } catch {
    return [];
  }
  return [];
}

function saveRecentlyViewed() {
  localStorage.setItem(recentlyViewedStorageKey, JSON.stringify(recentlyViewedIds.slice(0, 20)));
}

function recordRecentlyViewed(productId) {
  if (!productId) return;
  recentlyViewedIds = [productId, ...recentlyViewedIds.filter((id) => id !== productId)].slice(0, 20);
  saveRecentlyViewed();
  renderRecentlyViewed();
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function titleWithoutFirstMatch(title, value) {
  const cleanTitle = normalizeText(title);
  const cleanValue = normalizeText(value);
  if (!cleanValue) return cleanTitle;
  const escaped = cleanValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalizeText(cleanTitle.replace(new RegExp(escaped, "i"), ""));
}

function displayProductType(product) {
  const type = normalizeText(product.productType || "");
  const lower = type.toLowerCase();
  if (lower.includes("концентрированный кондиционер")) return "ополаскиватель";
  if (lower.includes("кондиционер для белья")) return "ополаскиватель";
  if (lower.includes("гель для стирки")) return "гель для стирки";
  if (lower.includes("стиральный порошок")) return "стиральный порошок";
  if (lower.includes("капсулы")) return "капсулы для стирки";
  if (lower.includes("мужской шампунь") || lower.includes("шампунь")) return "шампунь";
  if (lower.includes("кондиционер для волос")) return "кондиционер";
  if (lower.includes("гель для душа")) return "гель для душа";
  if (lower.includes("дезодорант")) return "дезодорант";
  if (lower.includes("зубная паста")) return "зубная паста";
  if (lower.includes("брить")) return "бритье";
  return type || normalizeText(product.category || "товар");
}

function productSize(title) {
  const text = normalizeText(title).replace(",", ".");
  const combo = text.match(/(?:^|\s)(\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g)\s*\+\s*\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g))(?:\s|$)/i);
  const single = text.match(/(?:^|\s)(\d+(?:\.\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g|шт))(?:\s|$)/i);
  const value = combo?.[1] || single?.[1] || "";
  return value.replace(/\./g, ",").replace(/\bml\b/i, "мл").replace(/\bl\b/i, "л").replace(/\bkg\b/i, "кг").replace(/\bg\b/i, "г");
}

function productDisplayParts(product) {
  const brand = normalizeText(product.brand || "Global Market");
  const type = displayProductType(product);
  const size = productSize(product.title);
  let variant = normalizeText(product.title);
  variant = titleWithoutFirstMatch(variant, brand);
  variant = titleWithoutFirstMatch(variant, product.productType);
  variant = titleWithoutFirstMatch(variant, type);
  variant = titleWithoutFirstMatch(variant, size);
  variant = normalizeText(
    variant
      .replace(/\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l|кг|kg|г|g|шт)/gi, "")
      .replace(/\s*\+\s*/g, " ")
      .replace(/[()]/g, " "),
  );
  if (!variant || variant.toLowerCase() === brand.toLowerCase()) {
    variant = normalizeText(product.description).split(".")[0] || product.title;
  }
  return { brand, type, size, variant };
}

function loadCustomer() {
  try {
    const customer = JSON.parse(localStorage.getItem("globalMarketCustomer") || "null");
    if (customer?.name && customer?.phone) return customer;
  } catch {
    return null;
  }
  return null;
}

function saveCustomer(customer) {
  state.customer = customer;
  localStorage.setItem("globalMarketCustomer", JSON.stringify(customer));
}

function clearCustomer() {
  state.customer = null;
  localStorage.removeItem("globalMarketCustomer");
}

function fillCheckoutFromCustomer() {
  const checkoutForm = document.querySelector("#checkoutForm");
  if (!checkoutForm || !state.customer) return;
  if (!checkoutForm.elements.name.value) checkoutForm.elements.name.value = state.customer.name;
  if (!checkoutForm.elements.phone.value) checkoutForm.elements.phone.value = state.customer.phone;
}

function renderCustomerPanel() {
  const registered = isRegisteredCustomer();
  customerCardTitle.textContent = registered ? "Скидка применена" : "Скидка после регистрации";
  customerCardText.textContent = registered
    ? `${state.customer.name}, для вас применена скидка ${catalogSettings.default_registered_discount_percent}% от розничной цены.`
    : `Укажите имя и WhatsApp, чтобы получить скидку ${catalogSettings.default_registered_discount_percent}%.`;
  customerForm.elements.customerName.value = state.customer?.name || "";
  customerForm.elements.customerPhone.value = state.customer?.phone || "";
  customerForm.querySelector("button[type='submit']").textContent = registered ? "Обновить данные" : "Зарегистрироваться";
  clearCustomerButton.hidden = !registered;
  fillCheckoutFromCustomer();
}

async function loadCatalog() {
  productGrid.innerHTML = '<p class="empty-cart">Загружаем каталог...</p>';
  const response = await fetch("data/public-catalog.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить каталог: ${response.status}`);
  }
  const catalog = await response.json();
  catalogSettings = { ...catalogSettings, ...catalog.settings };
  products = catalog.products.map((product) => ({
    ...product,
    price: product.retailPriceKgs,
    category: product.category || "Разное",
    description: product.description || "Товар в наличии. Детали заказа подтвердит менеджер.",
    tones: product.tones || ["#e4ded2", "#a99076"],
    icon: product.icon || "🛍️",
  }));
  const maxPrice = Math.max(...products.map((product) => product.price), 1000);
  state.maxPrice = Math.ceil(maxPrice / 500) * 500;
  priceRange.max = String(state.maxPrice);
  priceRange.value = String(state.maxPrice);
  priceOutput.textContent = currency.format(state.maxPrice);
  document.querySelector("#deliveryThreshold").textContent = currency.format(catalogSettings.free_delivery_threshold_kgs);
  document.querySelector("#deliveryThresholdCheckout").textContent = currency.format(catalogSettings.free_delivery_threshold_kgs);
  renderCustomerPanel();
  renderQuickCategories(catalog.categories || []);
  renderCategories();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderRecentlyViewed();
  renderProducts();
  renderCart();
}

function renderQuickCategories(catalogCategories) {
  const categories = catalogCategories.length
    ? catalogCategories
    : [...new Set(products.map((product) => product.category))].map((title) => ({ title, count: products.filter((product) => product.category === title).length }));
  menuCategories = categories;
  const countByCategory = new Map(categories.map((category) => [category.title, category.count]));
  quickCategoryGrid.innerHTML = quickCategoryCards
    .map((card) => {
      const count = products.filter((product) => {
        const matchesCategory = !card.category || product.category === card.category;
        const matchesQuery = !card.query || `${product.title} ${product.productType} ${product.description} ${product.searchText}`.toLowerCase().includes(card.query);
        return matchesCategory && matchesQuery;
      }).length || countByCategory.get(card.category) || 0;
      const dataAttributes = [
        card.category ? `data-category="${escapeHtml(card.category)}"` : "",
        card.query ? `data-query="${escapeHtml(card.query)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button class="quick-category" type="button" ${dataAttributes} data-label="${escapeHtml(card.title)}">
        <img src="${escapeHtml(card.image)}" alt="" loading="lazy" />
        <strong>${escapeHtml(card.title)}</strong>
        <small>${count} ${getProductWord(count)}</small>
      </button>`;
    })
    .join("");
  renderCategoryMenu();
}

function renderCategories() {
  const categories = ["Все", ...new Set(products.map((product) => product.category))];
  categoryFilter.innerHTML = categories
    .map((category) => {
      const count = category === "Все" ? products.length : products.filter((product) => product.category === category).length;
      return `<button class="filter-chip ${state.category === category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">
        <span>${category}</span><span>${count}</span>
      </button>`;
    })
    .join("");
}

function renderFavoriteFilter() {
  if (!favoriteFilterButton) return;
  const count = products.filter((product) => favoriteIds.has(product.id)).length;
  favoriteFilterButton.classList.toggle("active", state.favoriteOnly);
  favoriteFilterButton.setAttribute("aria-pressed", String(state.favoriteOnly));
  favoriteFilterButton.textContent = state.favoriteOnly ? `♥ Избранное (${count})` : `♡ Избранное${count ? ` (${count})` : ""}`;
}

function renderCategoryMenu() {
  if (!categoryMenu) return;
  const allCategories = [
    { title: "Все", icon: "⌂", count: products.length },
    ...menuCategories,
  ];
  categoryMenu.innerHTML = allCategories
    .map((category) => {
      const title = category.title;
      return `<button class="${state.category === title ? "active" : ""}" type="button" data-category="${escapeHtml(title)}">
        <span class="category-menu-icon" aria-hidden="true">${category.icon || "🛍️"}</span>
        <span class="category-menu-title">${escapeHtml(title === "Все" ? "Все товары" : title)}</span>
        <span class="category-menu-count">${category.count ?? ""}</span>
      </button>`;
    })
    .join("");
}

function setMenuOpen(isOpen) {
  if (!categoryMenu || !toggleMenuButton) return;
  categoryMenu.hidden = !isOpen;
  toggleMenuButton.setAttribute("aria-expanded", String(isOpen));
}

function selectCategory(category) {
  state.category = category;
  state.query = "";
  state.label = "";
  state.visibleLimit = 60;
  searchInput.value = "";
  headerSearchInput.value = "";
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderProducts();
}

function selectQuery(query, label = "") {
  state.category = "Все";
  state.query = query;
  state.label = label;
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderProducts();
}

function selectCategoryQuery(category, query, label = "") {
  state.category = category;
  state.query = query;
  state.label = label;
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderProducts();
}

function renderCatalogDirectory() {
  if (!catalogDirectory) return;
  const parts = [{ title: "Главная", category: "Все" }];
  if (state.category !== "Все") {
    parts.push({ title: displayCategoryName(state.category), category: state.category });
  }
  if (state.query) {
    parts.push({ title: state.label || state.query, query: state.query });
  }
  catalogDirectory.innerHTML = parts
    .map((part, index) => {
      const isCurrent = index === parts.length - 1;
      const attrs = part.query
        ? `data-query="${escapeHtml(part.query)}" data-label="${escapeHtml(part.title)}"`
        : `data-category="${escapeHtml(part.category)}"`;
      return `<button class="${isCurrent ? "current" : ""}" type="button" ${attrs} ${isCurrent ? 'aria-current="page"' : ""}>${escapeHtml(part.title)}</button>`;
    })
    .join('<span aria-hidden="true">/</span>');
}

function displayCategoryName(category) {
  const shortNames = {
    "Стирка и уход за бельем": "Стирка",
    "Уборка и чистота": "Чистка",
    "Уход за волосами": "Волосы",
    "Уход за телом": "Тело",
    "Зубная гигиена": "Зубы",
    "Парфюм 5 мл": "Парфюм",
    "Продукты": "Еда",
    "Товары из Германии": "Германия",
    "Разное": "Дом",
  };
  return shortNames[category] || category;
}

function getVisibleProducts() {
  const normalizedQuery = state.query.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const matchesFavorite = !state.favoriteOnly || favoriteIds.has(product.id);
    const matchesCategory = state.category === "Все" || product.category === state.category;
    const matchesPrice = productPrice(product) <= state.maxPrice;
    const matchesQuery = `${product.title} ${product.category} ${product.brand} ${product.productType} ${product.description} ${product.searchText}`
      .toLowerCase()
      .includes(normalizedQuery);
    return matchesFavorite && matchesCategory && matchesPrice && matchesQuery;
  });

  const sorted = filtered.sort((a, b) => {
    if (state.sort === "price-asc") return productPrice(a) - productPrice(b);
    if (state.sort === "price-desc") return productPrice(b) - productPrice(a);
    return featuredProductCompare(a, b);
  });

  if (state.sort === "featured" && state.category === "Все" && !normalizedQuery) {
    return diversifyFeaturedProducts(sorted);
  }

  return sorted;
}

function featuredProductCompare(a, b) {
  const imageScore = Number(hasProductImage(b)) - Number(hasProductImage(a));
  if (imageScore) return imageScore;
  const statusScore = Number(b.status === "active") - Number(a.status === "active");
  if (statusScore) return statusScore;
  const ratingScore = Number(b.rating || 0) - Number(a.rating || 0);
  if (ratingScore) return ratingScore;
  return a.title.localeCompare(b.title, "ru");
}

function diversifyFeaturedProducts(sortedProducts) {
  const photographed = sortedProducts.filter((product) => hasProductImage(product));
  const withoutPhotos = sortedProducts.filter((product) => !hasProductImage(product));
  return [
    ...diversifyProductGroup(photographed),
    ...diversifyProductGroup(withoutPhotos),
  ];
}

function diversifyProductGroup(sortedProducts) {
  const preferredCategoryOrder = [
    "perfume",
    "laundry",
    "home_cleaning",
    "hair",
    "body",
    "deodorants",
    "oral",
    "shaving",
    "food",
    "germany",
    "other",
  ];
  const buckets = new Map();
  sortedProducts.forEach((product) => {
    const key = product.categoryId || product.category || "other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(product);
  });

  const orderedKeys = [
    ...preferredCategoryOrder.filter((key) => buckets.has(key)),
    ...[...buckets.keys()].filter((key) => !preferredCategoryOrder.includes(key)).sort((a, b) => a.localeCompare(b, "ru")),
  ];
  const result = [];
  const usedBrands = new Set();
  let hasItems = true;

  while (hasItems) {
    hasItems = false;
    for (const key of orderedKeys) {
      const bucket = buckets.get(key);
      if (!bucket?.length) continue;
      hasItems = true;
      const preferredIndex = bucket.findIndex((product) => !usedBrands.has(product.brand || product.title));
      const [nextProduct] = bucket.splice(preferredIndex >= 0 ? preferredIndex : 0, 1);
      usedBrands.add(nextProduct.brand || nextProduct.title);
      result.push(nextProduct);
    }
    usedBrands.clear();
  }

  return result;
}

function renderRecentlyViewed() {
  if (!recentlyViewedSection || !recentlyViewedRow) return;
  const recentProducts = recentlyViewedIds
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean)
    .slice(0, 12);

  recentlyViewedSection.hidden = recentProducts.length === 0;
  if (!recentProducts.length) {
    recentlyViewedRow.innerHTML = "";
    return;
  }

  recentlyViewedRow.innerHTML = recentProducts
    .map((product) => {
      const display = productDisplayParts(product);
      return `
        <article class="recent-product">
          <button class="recent-product-image" type="button" data-recent-open="${product.id}" aria-label="Открыть ${escapeHtml(product.title)}">
            <img class="${hasProductImage(product) ? "" : "fallback-image"}" src="${escapeHtml(productCardImage(product))}" alt="${escapeHtml(product.title)}" loading="lazy">
            <span>${escapeHtml(display.brand)}</span>
          </button>
          <button class="recent-product-copy" type="button" data-recent-open="${product.id}">
            <strong>${escapeHtml(display.type)}</strong>
            <small>${escapeHtml(display.size || product.unit || "")}</small>
          </button>
          <div class="recent-product-action">
            <span>${currency.format(Math.round(productPrice(product)))}</span>
            <button type="button" data-recent-add="${product.id}" aria-label="Добавить ${escapeHtml(product.title)} в корзину">+</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function productBadges(product) {
  const badges = [];
  if (product.categoryId === "perfume" || product.brand === "Concord") badges.push("Новинка");
  if (hasProductImage(product) && Number(product.rating || 0) >= 4.8) badges.push("Хит");
  if (Number(product.retailPriceKgs || 0) > 0 && Number(product.retailPriceKgs) <= 500) badges.push("Выгодно");
  return badges.slice(0, 2);
}

function renderProducts() {
  const visibleProducts = getVisibleProducts();
  const pageProducts = visibleProducts.slice(0, state.visibleLimit);
  resultCount.textContent = `${visibleProducts.length} ${getProductWord(visibleProducts.length)}`;
  if (!visibleProducts.length) {
    productGrid.innerHTML = `<p class="empty-cart">${state.favoriteOnly ? "В избранном пока пусто." : "По этим фильтрам ничего не найдено."}</p>`;
    loadMore.hidden = true;
    return;
  }
  productGrid.innerHTML = pageProducts
    .map((product) => {
      const display = productDisplayParts(product);
      const badges = productBadges(product);
      return `
        <article class="product-card">
          <div class="product-visual" style="--tone-a: ${product.tones[0]}; --tone-b: ${product.tones[1]}">
            <span class="placeholder-brand">${escapeHtml(product.brand || "GM")}</span>
            <button class="favorite-button ${isFavorite(product.id) ? "active" : ""}" type="button" data-favorite="${product.id}" aria-label="${isFavorite(product.id) ? "Убрать из избранного" : "Добавить в избранное"}" aria-pressed="${isFavorite(product.id)}">${isFavorite(product.id) ? "♥" : "♡"}</button>
            ${
              badges.length
                ? `<div class="marketing-badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>`
                : ""
            }
            <img class="product-image ${hasProductImage(product) ? "" : "fallback-image"}" src="${escapeHtml(productCardImage(product))}" alt="${escapeHtml(product.title)}" loading="lazy" data-open-product="${product.id}">
          </div>
          <div class="product-info">
            <button class="product-title-button product-copy" type="button" data-open-product="${product.id}">
              <span class="product-brand-line">${escapeHtml(display.brand)}</span>
              <span class="product-kind-line">
                <strong>${escapeHtml(display.type)}</strong>
                ${display.size ? `<span>${escapeHtml(display.size)}</span>` : ""}
              </span>
              <span class="product-variant-line">${escapeHtml(display.variant)}</span>
            </button>
            <div class="product-meta product-meta-compact">
              <span>${escapeHtml(product.category)}</span>
            </div>
            <p>${escapeHtml(product.description)}</p>
            <div class="price-stack">
              <div class="price-action-row">
                <span class="price">${formatPrice(productPrice(product))}</span>
                <button class="add-button compact-add-button" type="button" data-add="${product.id}" aria-label="Добавить в корзину">В корзину</button>
              </div>
              <span class="registered-price-note">${
                isRegisteredCustomer()
                  ? `Скидка регистрации: ${catalogSettings.default_registered_discount_percent}%`
                  : `После регистрации: ${formatPrice(product.registeredPriceKgs)}`
              }</span>
            </div>
            <div class="buy-row">
              <span class="stock-note">Подтвердим наличие</span>
              <button class="details-button" type="button" data-open-product="${product.id}">Подробнее</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  const remaining = Math.max(visibleProducts.length - state.visibleLimit, 0);
  loadMore.hidden = remaining === 0;
  loadMore.textContent = `Показать еще (${remaining})`;
}

function imageLabel(path, index) {
  const lower = path.toLowerCase();
  if (lower.includes("back")) return "Обратная";
  if (lower.includes("alt")) return `Вариант ${index + 1}`;
  return "Лицевая";
}

function modalVisual(product) {
  const gallery = product.galleryImages?.length ? product.galleryImages : product.image ? [product.image] : [];
  if (!gallery.length) {
    const fallbackImage = fallbackImageFor(product);
    return `<button class="modal-image-zoom" type="button" data-zoom-image="${escapeHtml(fallbackImage)}" aria-label="Увеличить изображение категории">
      <img class="modal-product-image fallback-image" src="${escapeHtml(fallbackImage)}" alt="${escapeHtml(product.title)}">
      <span>Увеличить</span>
    </button>`;
  }
  const mainImage = gallery[0];
  return `
    <div class="modal-gallery" data-gallery-product="${product.id}">
      <button class="modal-image-zoom" type="button" data-zoom-image="${escapeHtml(mainImage)}" aria-label="Увеличить фото">
        <img class="modal-product-image" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.title)}" data-modal-main-image>
        <span>Увеличить</span>
      </button>
      ${
        gallery.length > 1
          ? `<div class="gallery-thumbs" aria-label="Фотографии товара">
              ${gallery
                .map(
                  (image, index) => `
                    <button class="gallery-thumb ${index === 0 ? "active" : ""}" type="button" data-gallery-image="${escapeHtml(image)}" aria-label="${escapeHtml(imageLabel(image, index))}">
                      <img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)} - ${escapeHtml(imageLabel(image, index))}">
                      <span>${escapeHtml(imageLabel(image, index))}</span>
                    </button>
                  `,
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function openProductModal(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  recordRecentlyViewed(productId);
  const display = productDisplayParts(product);

  const characteristics = [
    ["Бренд", product.brand || "Global Market"],
    ["Категория", product.category],
    ["Тип товара", product.productType || "Товар для дома"],
    ["Единица", product.unit || "шт"],
  ];

  productModalContent.innerHTML = `
    <article class="modal-product">
      <div class="modal-product-visual" style="--tone-a: ${product.tones[0]}; --tone-b: ${product.tones[1]}">
        <span class="placeholder-brand">${escapeHtml(product.brand || "GM")}</span>
        ${modalVisual(product)}
      </div>
      <div class="modal-product-info">
        <div class="modal-title-stack">
          <span class="modal-brand-line">${escapeHtml(display.brand)}</span>
          <h2 id="productModalTitle">${escapeHtml(display.type)}${display.size ? ` · ${escapeHtml(display.size)}` : ""}</h2>
          <span>${escapeHtml(display.variant)}</span>
        </div>
        <p>${escapeHtml(product.description)}</p>
        <div class="modal-price-box">
          <span>${isRegisteredCustomer() ? "Ваша цена" : "Цена"}</span>
          <strong>${formatPrice(productPrice(product))}</strong>
          <small>${
            isRegisteredCustomer()
              ? `Скидка регистрации: ${catalogSettings.default_registered_discount_percent}%`
              : `После регистрации: ${formatPrice(product.registeredPriceKgs)}`
          }</small>
        </div>
        <dl class="product-specs">
          ${characteristics
            .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
            .join("")}
        </dl>
        <div class="modal-note">
          Наличие, оплату и доставку подтверждает менеджер. Бесплатная доставка от ${formatPrice(catalogSettings.free_delivery_threshold_kgs)}.
        </div>
        <div class="modal-actions">
          <button class="modal-favorite-button ${isFavorite(product.id) ? "active" : ""}" type="button" data-modal-favorite="${product.id}" aria-pressed="${isFavorite(product.id)}">${isFavorite(product.id) ? "♥ В избранном" : "♡ В избранное"}</button>
          <button class="add-button" type="button" data-modal-add="${product.id}">В корзину</button>
          <a class="secondary-link" href="#checkout" id="modalCheckoutLink">К оформлению</a>
        </div>
      </div>
    </article>
  `;
  productModal.classList.add("open");
  productModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProductModal() {
  productModal.classList.remove("open");
  productModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  closeImageZoom();
}

function openImageZoom(src, alt) {
  closeImageZoom();
  activeZoomImage = document.createElement("div");
  activeZoomImage.className = "image-zoom-overlay";
  activeZoomImage.innerHTML = `
    <button class="image-zoom-close" type="button" aria-label="Закрыть увеличенное фото">×</button>
    <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">
  `;
  activeZoomImage.addEventListener("click", (event) => {
    if (event.target === activeZoomImage || event.target.closest(".image-zoom-close")) closeImageZoom();
  });
  document.body.appendChild(activeZoomImage);
  document.body.classList.add("zoom-open");
}

function closeImageZoom() {
  if (!activeZoomImage) return;
  activeZoomImage.remove();
  activeZoomImage = null;
  document.body.classList.remove("zoom-open");
}

function getProductWord(count) {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit === 1 && lastTwo !== 11) return "товар";
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return "товара";
  return "товаров";
}

function addToCart(productId) {
  const current = state.cart.get(productId) || 0;
  state.cart.set(productId, current + 1);
  renderCart();
}

function updateQty(productId, delta) {
  const next = (state.cart.get(productId) || 0) + delta;
  if (next <= 0) {
    state.cart.delete(productId);
  } else {
    state.cart.set(productId, next);
  }
  renderCart();
}

function cartEntries() {
  return [...state.cart.entries()]
    .map(([id, qty]) => ({ product: products.find((item) => item.id === id), qty }))
    .filter((entry) => entry.product);
}

function cartTotalValue() {
  return cartEntries().reduce((sum, entry) => sum + productPrice(entry.product) * entry.qty, 0);
}

function renderCart() {
  const entries = cartEntries();
  const totalCount = entries.reduce((sum, entry) => sum + entry.qty, 0);
  const total = cartTotalValue();
  cartCount.textContent = totalCount;
  cartTotal.textContent = formatPrice(total);
  const threshold = catalogSettings.free_delivery_threshold_kgs;
  const progress = threshold > 0 ? Math.min(total / threshold, 1) : 0;
  if (cartDeliveryProgressBar) cartDeliveryProgressBar.style.width = `${Math.round(progress * 100)}%`;
  if (cartDeliveryProgress) cartDeliveryProgress.hidden = total === 0;
  if (total >= catalogSettings.free_delivery_threshold_kgs) {
    cartDeliveryNote.textContent = "Бесплатная доставка доступна. Менеджер подтвердит условия.";
  } else {
    cartDeliveryNote.textContent = `До бесплатной доставки осталось ${formatPrice(catalogSettings.free_delivery_threshold_kgs - total)}.`;
  }

  if (entries.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Корзина пустая. Добавьте товары из каталога, чтобы оформить заказ.</p>';
    cartDeliveryNote.textContent = "Доставка согласуется с менеджером.";
    if (cartDeliveryProgress) cartDeliveryProgress.hidden = true;
    return;
  }

  cartItems.innerHTML = entries
    .map(
      ({ product, qty }) => `
        <article class="cart-item">
          <span class="cart-item-icon" aria-hidden="true">${product.icon}</span>
          <div>
            <strong>${escapeHtml(product.title)}</strong>
            <span>${formatPrice(productPrice(product))}</span>
            <div class="qty-controls" aria-label="Количество ${escapeHtml(product.title)}">
              <button type="button" data-qty="${product.id}" data-delta="-1">−</button>
              <span>${qty}</span>
              <button type="button" data-qty="${product.id}" data-delta="1">+</button>
            </div>
          </div>
          <button class="remove-button" type="button" data-remove="${product.id}">Убрать</button>
        </article>
      `,
    )
    .join("");
}

function setCartOpen(isOpen) {
  cartDrawer.classList.toggle("open", isOpen);
  cartDrawer.setAttribute("aria-hidden", String(!isOpen));
}

function orderMessage(formData) {
  const entries = cartEntries();
  const total = cartTotalValue();
  const delivery = total >= catalogSettings.free_delivery_threshold_kgs ? "Бесплатная доставка" : "Доставку согласовать с менеджером";
  const lines = entries.map(({ product, qty }, index) => {
    const lineTotal = productPrice(product) * qty;
    return `${index + 1}. ${product.title} — ${qty} ${product.unit || "шт"} x ${formatPrice(productPrice(product))} = ${formatPrice(lineTotal)}`;
  });

  return [
    "Новый заказ с сайта",
    "",
    `Клиент: ${formData.get("name")}`,
    `Телефон/WhatsApp: ${formData.get("phone")}`,
    `Город: ${formData.get("city") || "-"}`,
    `Регион: ${formData.get("region") || "-"}`,
    `Адрес: ${formData.get("address") || "-"}`,
    `Комментарий: ${formData.get("comment") || "-"}`,
    "",
    "Товары:",
    ...lines,
    "",
    `Итого: ${formatPrice(total)}`,
    `Доставка: ${delivery}`,
    "",
    "Цены и наличие подтверждает менеджер.",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

categoryFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectCategory(button.dataset.category);
});

quickCategoryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  const queryButton = event.target.closest("[data-query]");
  if (!button && !queryButton) return;
  const label = event.target.closest(".quick-category")?.dataset.label || "";
  if (button && queryButton) {
    selectCategoryQuery(button.dataset.category, queryButton.dataset.query, label);
  } else if (queryButton) {
    selectQuery(queryButton.dataset.query, label);
  } else {
    selectCategory(button.dataset.category);
  }
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});

recentlyViewedRow?.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-recent-add]");
  const openButton = event.target.closest("[data-recent-open]");
  if (addButton) {
    addToCart(addButton.dataset.recentAdd);
    setCartOpen(true);
    return;
  }
  if (openButton) openProductModal(openButton.dataset.recentOpen);
});

catalogDirectory?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.query) {
    selectQuery(button.dataset.query, button.dataset.label || button.dataset.query);
  } else {
    selectCategory(button.dataset.category || "Все");
  }
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});

toggleMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = categoryMenu?.hidden;
  setMenuOpen(Boolean(isOpen));
  if (siteHeader.classList.contains("search-open")) {
    siteHeader.classList.remove("search-open");
    toggleSearchButton.setAttribute("aria-expanded", "false");
  }
});

categoryMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectCategory(button.dataset.category);
  setMenuOpen(false);
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});

productGrid.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  const button = event.target.closest("[data-add]");
  const detailsButton = event.target.closest("[data-open-product]");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }
  if (button) {
    addToCart(button.dataset.add);
    setCartOpen(true);
    return;
  }
  if (detailsButton) openProductModal(detailsButton.dataset.openProduct);
});

productModal.addEventListener("click", (event) => {
  if (event.target === productModal) closeProductModal();
  const galleryButton = event.target.closest("[data-gallery-image]");
  const zoomButton = event.target.closest("[data-zoom-image]");
  const addButton = event.target.closest("[data-modal-add]");
  const favoriteButton = event.target.closest("[data-modal-favorite]");
  const checkoutLink = event.target.closest("#modalCheckoutLink");
  if (galleryButton) {
    const gallery = galleryButton.closest(".modal-gallery");
    const image = galleryButton.dataset.galleryImage;
    const mainImage = gallery?.querySelector("[data-modal-main-image]");
    const zoomTarget = gallery?.querySelector("[data-zoom-image]");
    if (mainImage && image) mainImage.src = image;
    if (zoomTarget && image) zoomTarget.dataset.zoomImage = image;
    gallery?.querySelectorAll(".gallery-thumb").forEach((button) => button.classList.toggle("active", button === galleryButton));
    return;
  }
  if (zoomButton) {
    openImageZoom(zoomButton.dataset.zoomImage, productModal.querySelector("#productModalTitle")?.textContent || "Фото товара");
    return;
  }
  if (addButton) {
    addToCart(addButton.dataset.modalAdd);
    closeProductModal();
    setCartOpen(true);
  }
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.modalFavorite);
    openProductModal(favoriteButton.dataset.modalFavorite);
    return;
  }
  if (checkoutLink) closeProductModal();
});

favoriteFilterButton?.addEventListener("click", () => {
  state.favoriteOnly = !state.favoriteOnly;
  state.visibleLimit = 60;
  renderFavoriteFilter();
  renderProducts();
});

cartItems.addEventListener("click", (event) => {
  const qtyButton = event.target.closest("[data-qty]");
  const removeButton = event.target.closest("[data-remove]");
  if (qtyButton) updateQty(qtyButton.dataset.qty, Number(qtyButton.dataset.delta));
  if (removeButton) {
    state.cart.delete(removeButton.dataset.remove);
    renderCart();
  }
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.label = "";
  headerSearchInput.value = state.query;
  state.visibleLimit = 60;
  renderCatalogDirectory();
  renderProducts();
});

headerSearchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.label = "";
  searchInput.value = state.query;
  state.visibleLimit = 60;
  renderCatalogDirectory();
  renderProducts();
});

priceRange.addEventListener("input", (event) => {
  state.maxPrice = Number(event.target.value);
  priceOutput.textContent = currency.format(state.maxPrice);
  state.visibleLimit = 60;
  renderProducts();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  state.visibleLimit = 60;
  renderProducts();
});

loadMore.addEventListener("click", () => {
  state.visibleLimit += 60;
  renderProducts();
});

document.querySelector("#openCart").addEventListener("click", () => setCartOpen(true));
document.querySelector("#closeCart").addEventListener("click", () => setCartOpen(false));
document.querySelector("#closeProductModal").addEventListener("click", closeProductModal);
document.querySelector("#checkoutLink").addEventListener("click", () => setCartOpen(false));

toggleSearchButton.addEventListener("click", () => {
  const isOpen = siteHeader.classList.toggle("search-open");
  toggleSearchButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) setMenuOpen(false);
  if (isOpen) headerSearchInput.focus();
});

heroDots?.addEventListener("click", (event) => {
  const dot = event.target.closest("[data-hero-slide]");
  if (!dot) return;
  manuallyShowHeroBanner(Number(dot.dataset.heroSlide));
});

heroPrevButton?.addEventListener("click", () => {
  manuallyShowHeroBanner(activeHeroIndex - 1);
});

heroNextButton?.addEventListener("click", () => {
  manuallyShowHeroBanner(activeHeroIndex + 1);
});

hero?.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  heroPointerId = event.pointerId;
  heroPointerStartX = event.clientX;
  heroPointerStartY = event.clientY;
  heroSwipeMoved = false;
});

hero?.addEventListener("pointermove", (event) => {
  if (heroPointerId !== event.pointerId) return;
  const deltaX = event.clientX - heroPointerStartX;
  const deltaY = event.clientY - heroPointerStartY;
  if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
    heroSwipeMoved = true;
  }
});

hero?.addEventListener("pointerup", (event) => {
  if (heroPointerId !== event.pointerId) return;
  const deltaX = event.clientX - heroPointerStartX;
  const deltaY = event.clientY - heroPointerStartY;
  heroPointerId = null;
  if (!heroSwipeMoved || Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
  suppressHeroClick = true;
  manuallyShowHeroBanner(deltaX < 0 ? activeHeroIndex + 1 : activeHeroIndex - 1);
  window.setTimeout(() => {
    suppressHeroClick = false;
  }, 0);
});

hero?.addEventListener("pointercancel", () => {
  heroPointerId = null;
  heroSwipeMoved = false;
});

hero?.addEventListener(
  "click",
  (event) => {
    if (!suppressHeroClick) return;
    event.preventDefault();
    event.stopPropagation();
  },
  true,
);

customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  saveCustomer({
    name: String(formData.get("customerName") || "").trim(),
    phone: String(formData.get("customerPhone") || "").trim(),
  });
  renderCustomerPanel();
  renderProducts();
  renderRecentlyViewed();
  renderCart();
  formStatus.textContent = "Регистрация сохранена. Скидка применена к корзине и каталогу.";
});

clearCustomerButton.addEventListener("click", () => {
  clearCustomer();
  renderCustomerPanel();
  renderProducts();
  renderRecentlyViewed();
  renderCart();
  formStatus.textContent = "Регистрация сброшена. В каталоге снова розничные цены.";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!categoryMenu?.hidden) {
      setMenuOpen(false);
      return;
    }
    if (siteHeader.classList.contains("search-open")) {
      siteHeader.classList.remove("search-open");
      toggleSearchButton.setAttribute("aria-expanded", "false");
      return;
    }
    if (activeZoomImage) {
      closeImageZoom();
      return;
    }
    closeProductModal();
    setCartOpen(false);
  }
});

document.addEventListener("click", (event) => {
  if (categoryMenu?.hidden) return;
  if (event.target.closest("#categoryMenu") || event.target.closest("#toggleMenu")) return;
  setMenuOpen(false);
});

cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) setCartOpen(false);
});

document.querySelector("#checkoutForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.cart.size) {
    formStatus.textContent = "Добавьте товары в корзину перед оформлением.";
    return;
  }
  const formData = new FormData(event.currentTarget);
  const message = orderMessage(formData);
  const whatsapp = `https://wa.me/${catalogSettings.manager_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  formStatus.innerHTML = `Открываем WhatsApp. Если он не открылся, <a href="${whatsapp}" target="_blank" rel="noreferrer">нажмите здесь</a>.`;
  window.location.href = whatsapp;
});

renderHeroBanners();
startHeroRotation();

loadCatalog().catch((error) => {
  productGrid.innerHTML = `<p class="empty-cart">${escapeHtml(error.message)}</p>`;
});
