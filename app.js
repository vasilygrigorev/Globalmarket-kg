let products = [];
let catalogSettings = {
  default_registered_discount_percent: 3,
  free_delivery_threshold_kgs: 10000,
  manager_whatsapp: "+996706771103",
};

const cartDraftStorageKey = "globalMarketCartDraft";
const lastOrderStorageKey = "globalMarketLastOrder";
const recentlyViewedStorageKey = "globalMarketRecentlyViewed";
const favoritesStorageKey = "globalMarketFavorites";
const attributionStorageKey = "globalMarketAttribution";
const customerDraftStorageKey = "globalMarketCustomerDraft";

const state = {
  category: "Все",
  query: "",
  label: "",
  favoriteOnly: false,
  collection: "",
  collectionLabel: "",
  maxPrice: 0,
  sort: "featured",
  visibleLimit: 60,
  cart: loadCartDraft(),
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
const openCartButton = document.querySelector("#openCart");
const floatingCartButton = document.querySelector("#floatingCart");
const floatingCartCount = document.querySelector("#floatingCartCount");
const backToTopButton = document.querySelector("#backToTop");
const repeatLastOrderButton = document.querySelector("#repeatLastOrder");
const productModal = document.querySelector("#productModal");
const productModalContent = document.querySelector("#productModalContent");
const modalTopActions = document.querySelector("#modalTopActions");
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

let recentlyViewedIds = loadRecentlyViewed();
let favoriteIds = new Set(loadFavorites());

let siteConfig = {};
let searchSynonymGroups = [];
let ignoredSearchDraftTerms = [];

let promoBanners = [
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

let quickCategoryCards = [
  { title: "Стирка", category: "Стирка и уход за бельем", image: "assets/category-cards/category-laundry-new.jpg" },
  { title: "Детское", category: "Уход за телом", image: "assets/category-cards/category-kids-new.jpg" },
  { title: "Европа", collection: "europe", image: "assets/category-cards/category-europe-new.jpg" },
  { title: "Бритье", category: "Бритье", image: "assets/category-cards/category-shaving-new.jpg" },
  { title: "Дезодоранты", category: "Дезодоранты", image: "assets/category-cards/category-deodorants-new.jpg" },
  { title: "Волосы", category: "Уход за волосами", image: "assets/category-cards/category-hair-new.jpg" },
  { title: "Чистка", category: "Уборка и чистота", image: "assets/category-cards/category-cleaning-new.jpg" },
  { title: "Парфюм", category: "Парфюм 5 мл", image: "assets/category-cards/category-perfume-new.jpg" },
  { title: "Кремы", category: "Уход за телом", query: "крем", image: "assets/category-cards/category-creams-new.jpg" },
  { title: "Тело", category: "Уход за телом", image: "assets/category-cards/category-body-new.jpg" },
  { title: "Зубы", category: "Зубная гигиена", image: "assets/category-cards/category-oral-new.jpg" },
];

let activeHeroIndex = 0;
let heroTimer = null;
let heroPointerStartX = 0;
let heroPointerStartY = 0;
let heroPointerId = null;
let heroSwipeMoved = false;
let suppressHeroClick = false;
let menuCategories = [];
let floatingCartTimer = null;
let lastHeaderScrollY = window.scrollY;
let headerScrollTicking = false;
let attribution = trackAttribution();

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

function formatPriceHtml(value) {
  return `${currency.format(Math.round(value))} <span class="som-sign">с</span>`;
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

function isConfigItemActive(item, now = new Date()) {
  if (item?.active === false) return false;

  const startsAt = item?.startsAt ? new Date(item.startsAt) : null;
  const endsAt = item?.endsAt ? new Date(item.endsAt) : null;

  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > now) return false;
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < now) return false;

  return true;
}

async function loadSiteConfig() {
  try {
    const response = await fetch("data/site-config.json", { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    siteConfig = config || {};
    if (Array.isArray(siteConfig.banners) && siteConfig.banners.length) {
      const activeBanners = siteConfig.banners.filter((banner) => isConfigItemActive(banner));
      if (activeBanners.length) promoBanners = activeBanners;
    }
    if (Array.isArray(siteConfig.quickCategories) && siteConfig.quickCategories.length) {
      quickCategoryCards = siteConfig.quickCategories;
    }
  } catch (error) {
    console.warn("Не удалось загрузить настройки сайта", error);
  }
}

async function loadSearchSynonyms() {
  try {
    const response = await fetch("data/search-synonyms.json", { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    searchSynonymGroups = Array.isArray(config.groups) ? config.groups : [];
    ignoredSearchDraftTerms = Array.isArray(config.ignoredDraftTerms) ? config.ignoredDraftTerms.map(normalizeSearchValue) : [];
  } catch (error) {
    console.warn("Не удалось загрузить словарь поиска", error);
  }
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

function favoriteIcon(active) {
  return `
    <svg class="heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.3 4.9 13.4C1.8 10.4 2 5.6 5.4 3.6c2.1-1.2 4.8-.7 6.6 1.2 1.8-1.9 4.5-2.4 6.6-1.2 3.4 2 3.6 6.8.5 9.8L12 20.3Z"></path>
    </svg>
  `;
}

function productShareUrl(product) {
  if (hasProductPage(product)) return productPageUrl(product, true);
  const url = new URL(window.location.href);
  url.searchParams.set("product", product.id);
  url.hash = `product-${product.id}`;
  return url.toString();
}

const translitMap = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugifyProductTitle(value) {
  const translit = String(value || "")
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => translitMap[letter] ?? "");
  return translit.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "product";
}

function hasProductPage(product) {
  return Boolean(product?.id && product?.retailPriceKgs && hasProductImage(product));
}

function productPageSlug(product) {
  return `${slugifyProductTitle(product.title || "product")}-${String(product.id || "").slice(-6)}`;
}

function productPageUrl(product, absolute = false) {
  const path = `/product/${productPageSlug(product)}/`;
  return absolute ? new URL(path, window.location.origin).toString() : path;
}

function productShareText(product) {
  const display = productDisplayParts(product);
  return [
    "Global Market KG",
    `${display.brand} ${display.type}${display.size ? ` ${display.size}` : ""}`.trim(),
    display.variant,
    `Цена: ${formatPrice(productPrice(product))}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function managerWhatsappLink(message) {
  const phone = catalogSettings.manager_whatsapp.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function productShortName(product) {
  const display = productDisplayParts(product);
  return `${display.brand} ${display.type}${display.size ? ` ${display.size}` : ""}`.trim();
}

function productQuestionText(product) {
  return [
    "Здравствуйте! Вопрос по товару с сайта Global Market KG.",
    "",
    `Товар: ${productShortName(product)}`,
    `Цена на сайте: ${formatPrice(productPrice(product))}`,
    `Ссылка: ${productShareUrl(product)}`,
    "",
    "Подскажите, пожалуйста, по наличию и деталям.",
  ].join("\n");
}

function productQuickOrderText(product) {
  const customer = state.customer;
  const lines = [
    "Быстрый заказ с сайта Global Market KG",
    "",
    `Товар: ${productShortName(product)}`,
    `Количество: 1 ${product.unit || "шт"}`,
    `Цена: ${formatPrice(productPrice(product))}`,
    `Ссылка: ${productShareUrl(product)}`,
  ];
  if (customer?.name || customer?.phone) {
    lines.push("", "Клиент:");
    if (customer.name) lines.push(`Имя: ${customer.name}`);
    if (customer.phone) lines.push(`Телефон/WhatsApp: ${customer.phone}`);
  }
  lines.push("", "Цены и наличие подтверждает менеджер.");
  return lines.join("\n");
}

function openProductWhatsapp(productId, mode) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const message = mode === "order" ? productQuickOrderText(product) : productQuestionText(product);
  const link = managerWhatsappLink(message);
  const opened = window.open(link, "_blank", "noopener");
  if (!opened) window.location.href = link;
}

async function shareProduct(productId, triggerButton) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const shareData = {
    title: product.title,
    text: productShareText(product),
    url: productShareUrl(product),
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
    if (triggerButton) {
      const isIconButton = triggerButton.classList.contains("modal-icon-action");
      const originalText = triggerButton.textContent;
      if (isIconButton) {
        triggerButton.classList.add("copied");
        triggerButton.setAttribute("aria-label", "Ссылка скопирована");
      } else {
        triggerButton.textContent = "Ссылка скопирована";
      }
      window.setTimeout(() => {
        if (isIconButton) {
          triggerButton.classList.remove("copied");
          triggerButton.setAttribute("aria-label", "Поделиться товаром");
        } else {
          triggerButton.textContent = originalText;
        }
      }, 1800);
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("Не удалось поделиться товаром", error);
    }
  }
}

function loadCartDraft() {
  try {
    const rows = JSON.parse(localStorage.getItem(cartDraftStorageKey) || "[]");
    if (!Array.isArray(rows)) return new Map();
    return new Map(
      rows
        .filter((row) => Array.isArray(row) && typeof row[0] === "string" && Number(row[1]) > 0)
        .map(([id, qty]) => [id, Math.min(Math.max(Math.round(Number(qty)), 1), 99)])
        .slice(0, 200),
    );
  } catch {
    return new Map();
  }
}

function saveCartDraft() {
  const rows = [...state.cart.entries()].filter(([, qty]) => qty > 0).slice(0, 200);
  localStorage.setItem(cartDraftStorageKey, JSON.stringify(rows));
}

function loadLastOrder() {
  try {
    const order = JSON.parse(localStorage.getItem(lastOrderStorageKey) || "null");
    if (Array.isArray(order?.items)) return order;
  } catch {
    return null;
  }
  return null;
}

function saveLastOrder() {
  const items = cartEntries().map(({ product, qty }) => ({ id: product.id, qty }));
  if (!items.length) return;
  localStorage.setItem(
    lastOrderStorageKey,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      items,
      totalKgs: cartTotalValue(),
    }),
  );
}

function repeatLastOrder() {
  const order = loadLastOrder();
  if (!order?.items?.length) return;
  const nextCart = new Map();
  order.items.forEach((item) => {
    if (products.some((product) => product.id === item.id) && Number(item.qty) > 0) {
      nextCart.set(item.id, Math.min(Math.max(Math.round(Number(item.qty)), 1), 99));
    }
  });
  if (!nextCart.size) return;
  state.cart = nextCart;
  saveCartDraft();
  renderCart();
  setCartOpen(true);
  if (formStatus) formStatus.textContent = "Последний заказ добавлен в корзину.";
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

function normalizeSearchValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,;:!?()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productSearchText(product) {
  return normalizeSearchValue(
    [
      product.title,
      product.category,
      product.categoryId,
      product.brand,
      product.productType,
      product.description,
      product.searchText,
      ...(product.collections || []),
    ].join(" "),
  );
}

function groupMatchesQuery(group, normalizedQuery) {
  const aliases = (group.aliases || []).map(normalizeSearchValue).filter(Boolean);
  return aliases.some((alias) => normalizedQuery.includes(alias));
}

function productMatchesSynonymGroup(product, group, text) {
  const categories = group.categories || [];
  const categoryIds = group.categoryIds || [];
  const collections = group.collections || [];
  const brands = group.brands || [];
  const terms = (group.terms || []).map(normalizeSearchValue).filter(Boolean);

  if (categories.includes(product.category)) return true;
  if (categoryIds.includes(product.categoryId)) return true;
  if ((product.collections || []).some((collection) => collections.includes(collection))) return true;
  if (brands.some((brand) => normalizeSearchValue(product.brand) === normalizeSearchValue(brand))) return true;
  return terms.some((term) => text.includes(term));
}

function productMatchesSearchQuery(product, query) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;
  if (normalizedQuery.includes("|")) {
    return normalizedQuery
      .split("|")
      .map((term) => normalizeSearchValue(term))
      .filter(Boolean)
      .some((term) => productMatchesSearchQuery(product, term));
  }
  if (ignoredSearchDraftTerms.includes(normalizedQuery)) return false;

  const text = productSearchText(product);
  if (text.includes(normalizedQuery)) return true;

  const queryTerms = normalizedQuery.split(" ").filter(Boolean);
  if (queryTerms.length > 1 && queryTerms.every((term) => text.includes(term))) return true;

  return searchSynonymGroups.some((group) => groupMatchesQuery(group, normalizedQuery) && productMatchesSynonymGroup(product, group, text));
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

function safeLocalStorageJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function compactValue(value) {
  return String(value || "").trim();
}

function displayValue(value) {
  const cleaned = compactValue(value);
  return cleaned || "не указано";
}

function loadCustomerDraft() {
  return safeLocalStorageJson(customerDraftStorageKey, {});
}

function saveCustomerDraftFromForm(form) {
  if (!form) return;
  const formData = new FormData(form);
  const draft = {
    name: compactValue(formData.get("name")),
    phone: compactValue(formData.get("phone")),
    customerSource: compactValue(formData.get("customerSource")),
    promoCode: compactValue(formData.get("promoCode")),
    city: compactValue(formData.get("city")),
    region: compactValue(formData.get("region")),
    address: compactValue(formData.get("address")),
    comment: compactValue(formData.get("comment")),
    marketingConsent: formData.get("marketingConsent") === "yes",
  };
  localStorage.setItem(customerDraftStorageKey, JSON.stringify(draft));
}

function fillCheckoutFromDraft() {
  const checkoutForm = document.querySelector("#checkoutForm");
  if (!checkoutForm) return;
  const draft = loadCustomerDraft();
  Object.entries(draft).forEach(([key, value]) => {
    const field = checkoutForm.elements[key];
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }
    if (!field.value) field.value = value || "";
  });
}

function trackAttribution() {
  const current = safeLocalStorageJson(attributionStorageKey, {});
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const now = new Date().toISOString();
  const next = { ...current };
  let changed = false;

  utmKeys.forEach((key) => {
    const value = compactValue(params.get(key));
    if (!value) return;
    next[key] = value;
    changed = true;
  });

  const referrer = compactValue(document.referrer);
  if (!changed && referrer) {
    next.referrer = referrer;
    changed = true;
  } else if (changed && referrer && !next.referrer) {
    next.referrer = referrer;
  }

  if (!changed) return current || {};
  if (!next.first_seen_at) next.first_seen_at = now;
  next.last_seen_at = now;
  localStorage.setItem(attributionStorageKey, JSON.stringify(next));
  return next;
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
  fillCheckoutFromDraft();
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
  applyCatalogParamsFromUrl();
  openSharedProductFromUrl();
}

function renderQuickCategories(catalogCategories) {
  const categories = catalogCategories.length
    ? catalogCategories.filter((category) => category.id !== "germany")
    : getVisibleCategoryTitles().map((title) => ({ title, count: products.filter((product) => product.category === title).length }));
  menuCategories = categories;
  const countByCategory = new Map(categories.map((category) => [category.title, category.count]));
  quickCategoryGrid.innerHTML = quickCategoryCards
    .map((card) => {
      const count = countProductsForShortcut(card, countByCategory);
      const dataAttributes = [
        card.category ? `data-category="${escapeHtml(card.category)}"` : "",
        card.collection ? `data-collection="${escapeHtml(card.collection)}"` : "",
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

function productMatchesShortcut(product, item) {
  const matchesCategory = !item.category || item.category === "Все" || product.category === item.category;
  const matchesCollection = !item.collection || productMatchesCollection(product, item.collection);
  const matchesQuery = !item.query || productMatchesSearchQuery(product, item.query);
  return matchesCategory && matchesCollection && matchesQuery;
}

function countProductsForShortcut(item, countByCategory = new Map()) {
  if (!item.category && !item.collection && !item.query) return "";
  if (item.category === "Все") return products.length;
  if (item.category && !item.collection && !item.query) return countByCategory.get(item.category) || 0;
  return products.filter((product) => productMatchesShortcut(product, item)).length;
}

function renderCategories() {
  if (!categoryFilter) return;
  const categories = ["Все", ...getVisibleCategoryTitles()];
  categoryFilter.innerHTML = categories
    .map((category) => {
      const count = category === "Все" ? products.length : products.filter((product) => product.category === category).length;
      return `<button class="filter-chip ${state.category === category && !state.collection ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">
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
  const configuredItems = Array.isArray(siteConfig.menu) && siteConfig.menu.length
    ? siteConfig.menu
    : [{ label: "Все товары", category: "Все" }, ...menuCategories.map((category) => ({ label: category.title, category: category.title }))];
  const countByCategory = new Map(menuCategories.map((category) => [category.title, category.count]));
  categoryMenu.innerHTML = configuredItems
    .map((item) => {
      const count = countProductsForShortcut(item, countByCategory);
      const isActive = (item.category && state.category === item.category && !state.collection) || (item.collection && state.collection === item.collection);
      const attributes = [
        item.category ? `data-category="${escapeHtml(item.category)}"` : "",
        item.collection ? `data-collection="${escapeHtml(item.collection)}"` : "",
        item.query ? `data-query="${escapeHtml(item.query)}"` : "",
        item.label ? `data-label="${escapeHtml(item.label)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const content = `
        <span class="category-menu-title">${escapeHtml(item.label || item.title || item.category || "Раздел")}</span>
        <span class="category-menu-count">${count ?? ""}</span>
      `;
      if (item.href) {
        return `<a class="${isActive ? "active" : ""}" href="${escapeHtml(item.href)}">${content}</a>`;
      }
      return `<button class="${isActive ? "active" : ""}" type="button" ${attributes}>${content}</button>`;
    })
    .join("");
}

function setMenuOpen(isOpen) {
  if (!categoryMenu || !toggleMenuButton) return;
  categoryMenu.hidden = !isOpen;
  toggleMenuButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) revealSmartHeader();
}

function selectCategory(category) {
  state.category = category;
  state.query = "";
  state.label = "";
  state.collection = "";
  state.collectionLabel = "";
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
  state.collection = "";
  state.collectionLabel = "";
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
  state.collection = "";
  state.collectionLabel = "";
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderProducts();
}

function selectCollection(collection, label = "") {
  state.category = "Все";
  state.query = "";
  state.label = "";
  state.collection = collection;
  state.collectionLabel = label || displayCollectionName(collection);
  state.visibleLimit = 60;
  searchInput.value = "";
  headerSearchInput.value = "";
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderProducts();
}

function selectCollectionQuery(collection, query, label = "") {
  state.category = "Все";
  state.query = query;
  state.label = label || query;
  state.collection = collection;
  state.collectionLabel = displayCollectionName(collection);
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderProducts();
}

function mergedUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash || "";
  const hashQueryIndex = hash.indexOf("?");
  if (hashQueryIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(hashQueryIndex + 1));
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }
  return params;
}

function applyCatalogParamsFromUrl() {
  const params = mergedUrlParams();
  const collection = params.get("collection");
  const category = params.get("category");
  const query = params.get("q") || params.get("query");
  const label = params.get("label") || "";

  if (collection && query) {
    selectCollectionQuery(collection, query, label || query);
  } else if (collection) {
    selectCollection(collection, label || displayCollectionName(collection));
  } else if (category && query) {
    selectCategoryQuery(category, query, label || query);
  } else if (category) {
    selectCategory(category);
  } else if (query) {
    selectQuery(query, label || query);
  } else {
    return false;
  }

  if (window.location.hash.includes("catalog")) {
    document.querySelector("#catalog")?.scrollIntoView({ behavior: "auto" });
  }
  return true;
}

function renderCatalogDirectory() {
  if (!catalogDirectory) return;
  const parts = [{ title: "Главная", category: "Все" }];
  if (state.category !== "Все") {
    parts.push({ title: displayCategoryName(state.category), category: state.category });
  }
  if (state.collection) {
    parts.push({ title: state.collectionLabel || displayCollectionName(state.collection), collection: state.collection });
  }
  if (state.query) {
    parts.push({ title: state.label || state.query, query: state.query });
  }
  catalogDirectory.innerHTML = parts
    .map((part, index) => {
      const isCurrent = index === parts.length - 1;
      const attrs = part.query
        ? `data-query="${escapeHtml(part.query)}" data-label="${escapeHtml(part.title)}"`
        : part.collection
          ? `data-collection="${escapeHtml(part.collection)}" data-label="${escapeHtml(part.title)}"`
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
    "Товары из Германии": "Европа",
    "Европа": "Европа",
    "Разное": "Дом",
  };
  return shortNames[category] || category;
}

function displayCollectionName(collection) {
  const names = {
    europe: "Европа",
    germany: "Европа",
  };
  return names[collection] || collection;
}

function getVisibleCategoryTitles() {
  const hiddenLegacyCategoryIds = new Set(["germany"]);
  const titles = [];
  products.forEach((product) => {
    if (hiddenLegacyCategoryIds.has(product.categoryId)) return;
    if (product.category && !titles.includes(product.category)) titles.push(product.category);
  });
  return titles;
}

function productMatchesCollection(product, collection) {
  if (!collection) return true;
  const aliases = collection === "europe" ? ["europe", "germany"] : [collection];
  const productCollections = product.collections || [];
  return aliases.some((alias) => productCollections.includes(alias))
    || (collection === "europe" && (product.categoryId === "germany" || product.category === "Товары из Германии" || product.category === "Европа"));
}

function getVisibleProducts() {
  const normalizedQuery = normalizeSearchValue(state.query);
  const filtered = products.filter((product) => {
    const matchesFavorite = !state.favoriteOnly || favoriteIds.has(product.id);
    const matchesCategory = state.category === "Все" || product.category === state.category;
    const matchesCollection = productMatchesCollection(product, state.collection);
    const matchesPrice = productPrice(product) <= state.maxPrice;
    const matchesQuery = productMatchesSearchQuery(product, normalizedQuery);
    return matchesFavorite && matchesCategory && matchesCollection && matchesPrice && matchesQuery;
  });

  const sorted = filtered.sort((a, b) => {
    if (state.sort === "price-asc") return productPrice(a) - productPrice(b);
    if (state.sort === "price-desc") return productPrice(b) - productPrice(a);
    return featuredProductCompare(a, b);
  });

  if (state.sort === "featured" && state.category === "Все" && !state.collection && !normalizedQuery) {
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
      const href = hasProductPage(product) ? productPageUrl(product) : "";
      const imageAction = href
        ? `href="${escapeHtml(href)}" data-product-link="${product.id}"`
        : `href="#" data-recent-open="${product.id}"`;
      return `
        <article class="recent-product">
          <a class="recent-product-image" ${imageAction} aria-label="Открыть ${escapeHtml(product.title)}">
            <img class="${hasProductImage(product) ? "" : "fallback-image"}" src="${escapeHtml(productCardImage(product))}" alt="${escapeHtml(product.title)}" loading="lazy">
            <span>${escapeHtml(display.brand)}</span>
          </a>
          <a class="recent-product-copy" ${imageAction}>
            <strong>${escapeHtml(display.type)}</strong>
            <small>${escapeHtml(display.size || product.unit || "")}</small>
          </a>
          <div class="recent-product-action">
            <span>${formatPriceHtml(productPrice(product))}</span>
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

// A manual promo discount (data/discounts.json -> discountPercent/originalPriceKgs on
// the catalog, never a redesign of the real price): both fields must be present and
// positive, and the "was" price must actually be higher than the current one.
function hasDiscount(product) {
  return (
    Number(product.discountPercent || 0) > 0 &&
    Number(product.originalPriceKgs || 0) > Number(product.retailPriceKgs || 0)
  );
}

function discountBadgeHtml(product) {
  if (!hasDiscount(product)) return "";
  return `<span class="discount-badge">-${Math.round(product.discountPercent)}%</span>`;
}

// Current price, with the crossed-out original price alongside it when a promo
// discount is active. Falls back to the plain price otherwise.
function priceWithDiscountHtml(product) {
  const current = formatPriceHtml(productPrice(product));
  if (!hasDiscount(product)) return `<span class="price">${current}</span>`;
  return `
    <span class="price-group">
      <span class="price">${current}</span>
      <span class="price-original">${formatPriceHtml(product.originalPriceKgs)}</span>
    </span>
  `;
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
      const href = hasProductPage(product) ? productPageUrl(product) : "";
      const cardLink = href
        ? `href="${escapeHtml(href)}" data-product-link="${product.id}"`
        : `href="#" data-open-product="${product.id}"`;
      return `
        <article class="product-card">
          <div class="product-visual" style="--tone-a: ${product.tones[0]}; --tone-b: ${product.tones[1]}">
            <span class="placeholder-brand">${escapeHtml(product.brand || "GM")}</span>
            <button class="favorite-button ${isFavorite(product.id) ? "active" : ""}" type="button" data-favorite="${product.id}" aria-label="${isFavorite(product.id) ? "Убрать из избранного" : "Добавить в избранное"}" aria-pressed="${isFavorite(product.id)}">${favoriteIcon(isFavorite(product.id))}</button>
            ${
              badges.length
                ? `<div class="marketing-badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>`
                : ""
            }
            ${discountBadgeHtml(product)}
            <a class="product-image-link" ${cardLink} aria-label="Открыть ${escapeHtml(product.title)}">
              <img class="product-image ${hasProductImage(product) ? "" : "fallback-image"}" src="${escapeHtml(productCardImage(product))}" alt="${escapeHtml(product.title)}" loading="lazy">
            </a>
          </div>
          <div class="product-info">
            <a class="product-title-button product-copy" ${cardLink}>
              <span class="product-brand-line">${escapeHtml(display.brand)}</span>
              <span class="product-kind-line">
                <strong>${escapeHtml(display.type)}</strong>
                ${display.size ? `<span>${escapeHtml(display.size)}</span>` : ""}
              </span>
              <span class="product-variant-line">${escapeHtml(display.variant)}</span>
            </a>
            <div class="product-meta product-meta-compact">
              <span>${escapeHtml(product.category)}</span>
            </div>
            <p>${escapeHtml(product.description)}</p>
            <div class="price-stack">
              <div class="price-action-row">
                ${priceWithDiscountHtml(product)}
                <button class="add-button compact-add-button" type="button" data-add="${product.id}" aria-label="Добавить в корзину">В корзину</button>
              </div>
              <span class="registered-price-note">${
                isRegisteredCustomer()
                  ? `Скидка регистрации: ${catalogSettings.default_registered_discount_percent}%`
                  : `После регистрации: ${formatPriceHtml(product.registeredPriceKgs)}`
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
    </button>`;
  }
  const mainImage = gallery[0];
  return `
    <div class="modal-gallery" data-gallery-product="${product.id}">
      <button class="modal-image-zoom" type="button" data-zoom-image="${escapeHtml(mainImage)}" aria-label="Увеличить фото">
        <img class="modal-product-image" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.title)}" data-modal-main-image>
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

  modalTopActions.innerHTML = `
    <button class="modal-icon-action modal-favorite-icon ${isFavorite(product.id) ? "active" : ""}" type="button" data-modal-favorite="${product.id}" aria-label="${isFavorite(product.id) ? "Убрать из избранного" : "Добавить в избранное"}" aria-pressed="${isFavorite(product.id)}">
      ${favoriteIcon(isFavorite(product.id))}
    </button>
    <button class="modal-icon-action" type="button" data-share-product="${product.id}" aria-label="Поделиться товаром">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"></path>
      </svg>
    </button>
  `;

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
          <span>${isRegisteredCustomer() ? "Ваша цена" : "Цена"}${hasDiscount(product) ? ` · скидка ${Math.round(product.discountPercent)}%` : ""}</span>
          <strong>
            ${formatPriceHtml(productPrice(product))}
            ${hasDiscount(product) ? `<span class="price-original">${formatPriceHtml(product.originalPriceKgs)}</span>` : ""}
          </strong>
          <small>${
            isRegisteredCustomer()
              ? `Скидка регистрации: ${catalogSettings.default_registered_discount_percent}%`
              : `После регистрации: ${formatPriceHtml(product.registeredPriceKgs)}`
          }</small>
        </div>
        <dl class="product-specs">
          ${characteristics
            .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
            .join("")}
        </dl>
        <div class="modal-note">
          Наличие, оплату и доставку подтверждает менеджер. Бесплатная доставка от ${formatPriceHtml(catalogSettings.free_delivery_threshold_kgs)}.
        </div>
        <div class="modal-actions">
          <button class="add-button" type="button" data-modal-add="${product.id}">В корзину</button>
          <button class="secondary-link wa-button" type="button" data-quick-order="${product.id}">Заказать в 1 клик</button>
          <button class="secondary-link wa-question" type="button" data-ask-product="${product.id}">Спросить в WhatsApp</button>
          <a class="secondary-link" href="#checkout" id="modalCheckoutLink">К оформлению</a>
        </div>
      </div>
    </article>
  `;
  productModal.classList.add("open");
  productModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  revealSmartHeader();
}

function closeProductModal() {
  productModal.classList.remove("open");
  productModal.setAttribute("aria-hidden", "true");
  modalTopActions.innerHTML = "";
  document.body.classList.remove("modal-open");
  closeImageZoom();
}

function openSharedProductFromUrl() {
  const params = mergedUrlParams();
  const productId = params.get("product") || window.location.hash.replace(/^#product-/, "");
  if (!productId || !products.some((product) => product.id === productId)) return;
  openProductModal(productId);
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
  revealSmartHeader();
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
  saveCartDraft();
  renderCart();
}

function isHeaderCartVisible() {
  if (!openCartButton) return false;
  const rect = openCartButton.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

function pulseVisibleCart() {
  openCartButton?.classList.remove("cart-feedback");
  void openCartButton?.offsetWidth;
  openCartButton?.classList.add("cart-feedback");
  window.setTimeout(() => openCartButton?.classList.remove("cart-feedback"), 700);
}

function showFloatingCartFeedback() {
  if (!floatingCartButton) return;
  window.clearTimeout(floatingCartTimer);
  floatingCartButton.hidden = false;
  floatingCartButton.classList.add("show");
  floatingCartTimer = window.setTimeout(() => {
    floatingCartButton.classList.remove("show");
    window.setTimeout(() => {
      if (!floatingCartButton.classList.contains("show")) floatingCartButton.hidden = true;
    }, 180);
  }, 850);
}

function showAddFeedback(button) {
  if (button) {
    const originalText = button.dataset.originalText || button.textContent;
    button.dataset.originalText = originalText;
    button.classList.add("added");
    if (!button.classList.contains("compact-add-button")) button.textContent = "Добавлено";
    window.setTimeout(() => {
      button.classList.remove("added");
      if (!button.classList.contains("compact-add-button")) button.textContent = button.dataset.originalText || originalText;
    }, 700);
  }

  if (isHeaderCartVisible()) {
    pulseVisibleCart();
  } else {
    showFloatingCartFeedback();
  }
}

function updateQty(productId, delta) {
  const next = (state.cart.get(productId) || 0) + delta;
  if (next <= 0) {
    state.cart.delete(productId);
  } else {
    state.cart.set(productId, next);
  }
  saveCartDraft();
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
  if (floatingCartCount) floatingCartCount.textContent = totalCount;
  cartTotal.innerHTML = formatPriceHtml(total);
  if (repeatLastOrderButton) repeatLastOrderButton.hidden = !loadLastOrder();
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
          <img class="cart-item-image ${hasProductImage(product) ? "" : "fallback-image"}" src="${escapeHtml(productCardImage(product))}" alt="${escapeHtml(product.title)}">
          <div>
            <strong>${escapeHtml(product.title)}</strong>
            <span>${formatPriceHtml(productPrice(product))}</span>
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
  if (isOpen) revealSmartHeader();
  updateBackToTopButton();
}

function updateSiteHeaderHeight() {
  document.documentElement.style.setProperty("--site-header-height", `${siteHeader.offsetHeight}px`);
}

function shouldKeepHeaderVisible() {
  return (
    window.scrollY < 90 ||
    !categoryMenu?.hidden ||
    siteHeader.classList.contains("search-open") ||
    cartDrawer.classList.contains("open") ||
    productModal.classList.contains("open") ||
    Boolean(activeZoomImage)
  );
}

function revealSmartHeader() {
  updateSiteHeaderHeight();
  siteHeader.classList.remove("header-hidden");
  siteHeader.classList.toggle("header-floating", window.scrollY > 16);
}

function updateBackToTopButton() {
  if (!backToTopButton) return;
  const shouldShow = window.scrollY > 900 && !cartDrawer.classList.contains("open") && !productModal.classList.contains("open");
  backToTopButton.hidden = !shouldShow;
  backToTopButton.classList.toggle("show", shouldShow);
}

function updateSmartHeader() {
  const currentY = Math.max(window.scrollY, 0);
  const delta = currentY - lastHeaderScrollY;

  if (shouldKeepHeaderVisible()) {
    revealSmartHeader();
  } else if (delta > 8 && currentY > 150) {
    siteHeader.classList.add("header-hidden");
    siteHeader.classList.add("header-floating");
  } else if (delta < -6) {
    revealSmartHeader();
  } else {
    siteHeader.classList.toggle("header-floating", currentY > 16);
  }

  lastHeaderScrollY = currentY;
  updateBackToTopButton();
  headerScrollTicking = false;
}

function requestSmartHeaderUpdate() {
  if (headerScrollTicking) return;
  headerScrollTicking = true;
  window.requestAnimationFrame(updateSmartHeader);
}

function orderMessage(formData) {
  const entries = cartEntries();
  const total = cartTotalValue();
  const delivery = total >= catalogSettings.free_delivery_threshold_kgs ? "Бесплатная доставка" : "Доставку согласовать с менеджером";
  const lines = entries.map(({ product, qty }, index) => {
    const lineTotal = productPrice(product) * qty;
    return `${index + 1}. ${product.title} — ${qty} ${product.unit || "шт"} x ${formatPrice(productPrice(product))} = ${formatPrice(lineTotal)}`;
  });
  const sourceSiteLines = [
    `utm_source: ${displayValue(attribution.utm_source)}`,
    `utm_medium: ${displayValue(attribution.utm_medium)}`,
    `utm_campaign: ${displayValue(attribution.utm_campaign)}`,
    `utm_content: ${displayValue(attribution.utm_content)}`,
    `utm_term: ${displayValue(attribution.utm_term)}`,
    `referrer: ${displayValue(attribution.referrer)}`,
  ];

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
    "Клиент:",
    `Имя: ${displayValue(formData.get("name"))}`,
    `Телефон/WhatsApp: ${displayValue(formData.get("phone"))}`,
    `Откуда узнали: ${displayValue(formData.get("customerSource"))}`,
    `Промокод/код: ${displayValue(formData.get("promoCode"))}`,
    `Согласие на обратную связь: ${formData.get("marketingConsent") === "yes" ? "да" : "нет"}`,
    "",
    "Источник сайта:",
    ...sourceSiteLines,
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
  const collectionButton = event.target.closest("[data-collection]");
  const queryButton = event.target.closest("[data-query]");
  if (!button && !collectionButton && !queryButton) return;
  const label = event.target.closest(".quick-category")?.dataset.label || "";
  if (button && queryButton) {
    selectCategoryQuery(button.dataset.category, queryButton.dataset.query, label);
  } else if (collectionButton) {
    selectCollection(collectionButton.dataset.collection, label);
  } else if (queryButton) {
    selectQuery(queryButton.dataset.query, label);
  } else {
    selectCategory(button.dataset.category);
  }
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});

recentlyViewedRow?.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-recent-add]");
  const productLink = event.target.closest("[data-product-link]");
  const openButton = event.target.closest("[data-recent-open]");
  if (addButton) {
    addToCart(addButton.dataset.recentAdd);
    showAddFeedback(addButton);
    return;
  }
  if (productLink) {
    recordRecentlyViewed(productLink.dataset.productLink);
    return;
  }
  if (openButton) {
    event.preventDefault();
    openProductModal(openButton.dataset.recentOpen);
  }
});

catalogDirectory?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.query) {
    selectQuery(button.dataset.query, button.dataset.label || button.dataset.query);
  } else if (button.dataset.collection) {
    selectCollection(button.dataset.collection, button.dataset.label || displayCollectionName(button.dataset.collection));
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
  const link = event.target.closest("a");
  if (link) {
    setMenuOpen(false);
    return;
  }
  const button = event.target.closest("[data-category], [data-collection], [data-query]");
  if (!button) return;
  if (button.dataset.query && button.dataset.category) {
    selectCategoryQuery(button.dataset.category, button.dataset.query, button.dataset.label || button.dataset.query);
  } else if (button.dataset.query) {
    selectQuery(button.dataset.query, button.dataset.label || button.dataset.query);
  } else if (button.dataset.collection) {
    selectCollection(button.dataset.collection, button.dataset.label || displayCollectionName(button.dataset.collection));
  } else {
    selectCategory(button.dataset.category || "Все");
  }
  setMenuOpen(false);
  document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
});

productGrid.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  const button = event.target.closest("[data-add]");
  const productLink = event.target.closest("[data-product-link]");
  const detailsButton = event.target.closest("[data-open-product]");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }
  if (button) {
    addToCart(button.dataset.add);
    showAddFeedback(button);
    return;
  }
  if (productLink) {
    recordRecentlyViewed(productLink.dataset.productLink);
    return;
  }
  if (detailsButton) {
    event.preventDefault();
    openProductModal(detailsButton.dataset.openProduct);
  }
});

productModal.addEventListener("click", (event) => {
  if (event.target === productModal) closeProductModal();
  const galleryButton = event.target.closest("[data-gallery-image]");
  const zoomButton = event.target.closest("[data-zoom-image]");
  const addButton = event.target.closest("[data-modal-add]");
  const favoriteButton = event.target.closest("[data-modal-favorite]");
  const shareButton = event.target.closest("[data-share-product]");
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
    showAddFeedback(addButton);
    return;
  }
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.modalFavorite);
    openProductModal(favoriteButton.dataset.modalFavorite);
    return;
  }
  if (shareButton) {
    shareProduct(shareButton.dataset.shareProduct, shareButton);
    return;
  }
  const quickOrderButton = event.target.closest("[data-quick-order]");
  if (quickOrderButton) {
    openProductWhatsapp(quickOrderButton.dataset.quickOrder, "order");
    return;
  }
  const askButton = event.target.closest("[data-ask-product]");
  if (askButton) {
    openProductWhatsapp(askButton.dataset.askProduct, "question");
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
    saveCartDraft();
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

openCartButton?.addEventListener("click", () => setCartOpen(true));
floatingCartButton?.addEventListener("click", () => {
  floatingCartButton.classList.remove("show");
  floatingCartButton.hidden = true;
  setCartOpen(true);
});
backToTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
repeatLastOrderButton?.addEventListener("click", repeatLastOrder);
document.querySelector("#closeCart").addEventListener("click", () => setCartOpen(false));
document.querySelector("#closeProductModal").addEventListener("click", closeProductModal);
document.querySelector("#checkoutLink").addEventListener("click", () => setCartOpen(false));

const checkoutForm = document.querySelector("#checkoutForm");
checkoutForm.addEventListener("input", () => saveCustomerDraftFromForm(checkoutForm));
checkoutForm.addEventListener("change", () => saveCustomerDraftFromForm(checkoutForm));

toggleSearchButton.addEventListener("click", () => {
  const isOpen = siteHeader.classList.toggle("search-open");
  toggleSearchButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) setMenuOpen(false);
  if (isOpen) {
    revealSmartHeader();
    headerSearchInput.focus();
  }
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

window.addEventListener("scroll", requestSmartHeaderUpdate, { passive: true });
window.addEventListener("resize", () => {
  updateSiteHeaderHeight();
  requestSmartHeaderUpdate();
});

if ("ResizeObserver" in window) {
  new ResizeObserver(updateSiteHeaderHeight).observe(siteHeader);
}

cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) setCartOpen(false);
});

function buildOrderPayload(formData, message) {
  return {
    customer: {
      name: formData.get("name"),
      phone: formData.get("phone"),
      city: formData.get("city"),
      region: formData.get("region"),
      address: formData.get("address"),
      comment: formData.get("comment"),
    },
    items: cartEntries().map(({ product, qty }) => ({
      product_id: product.id,
      product_slug: hasProductPage(product) ? productPageSlug(product) : "",
      title: product.title,
      brand: product.brand,
      unit: product.unit,
      qty,
      price_kgs: productPrice(product),
      image: product.image,
    })),
    attribution: {
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      referrer: attribution.referrer,
    },
    customer_source: formData.get("customerSource"),
    promo_code: formData.get("promoCode"),
    consent: { consent_type: "marketing", is_granted: formData.get("marketingConsent") === "yes" },
    whatsapp_message: message,
  };
}

// Optional backend save. Disabled by default via site-config (ordersApi.enabled).
// Returns the API response on success, or null so the caller falls back to the
// normal WhatsApp-only flow. Never throws.
async function saveOrderViaApi(payload) {
  const cfg = siteConfig.ordersApi || {};
  if (!cfg.enabled) return null;
  const endpoint = cfg.endpoint || "/api/orders";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

// Guards against a duplicate /api/orders submission from a quick double-click
// or double-tap while the async save is still in flight (the button stays
// enabled visually only for as long as the network round trip takes).
let checkoutSubmitting = false;

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (checkoutSubmitting) return;
  if (!state.cart.size) {
    formStatus.textContent = "Добавьте товары в корзину перед оформлением.";
    return;
  }
  checkoutSubmitting = true;
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  try {
    const formData = new FormData(event.currentTarget);
    saveCustomerDraftFromForm(event.currentTarget);
    const message = orderMessage(formData);
    let whatsapp = `https://wa.me/${catalogSettings.manager_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    // If the backend is enabled, save the order first; always fall back to WhatsApp.
    const saved = await saveOrderViaApi(buildOrderPayload(formData, message));
    if (saved && saved.manager_whatsapp_url) whatsapp = saved.manager_whatsapp_url;
    saveLastOrder();
    formStatus.innerHTML = `Открываем WhatsApp. Если он не открылся, <a href="${whatsapp}" target="_blank" rel="noreferrer">нажмите здесь</a>.`;
    window.location.href = whatsapp;
  } finally {
    checkoutSubmitting = false;
    if (submitButton) submitButton.disabled = false;
  }
});

async function initStorefront() {
  await loadSiteConfig();
  await loadSearchSynonyms();
  updateSiteHeaderHeight();
  updateBackToTopButton();
  renderHeroBanners();
  startHeroRotation();
  await loadCatalog();
}

initStorefront().catch((error) => {
  productGrid.innerHTML = `<p class="empty-cart">${escapeHtml(error.message)}</p>`;
});
