let products = [];
let latestStockDate = "";
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
  audience: "",
  audienceLabel: "",
  query: "",
  label: "",
  favoriteOnly: false,
  collection: "",
  collectionLabel: "",
  maxPrice: 0,
  sort: "featured",
  visibleLimit: 60,
  cart: loadCartDraft(),
  // Populated by refreshSession() — an SMS-verified login session (see
  // functions/api/customer-profile.js), never a locally-typed "registration".
  // null means logged out (retail/guest pricing).
  session: null,
};

const productGrid = document.querySelector("#productGrid");
const categoryFilter = document.querySelector("#categoryFilter");
const searchInput = document.querySelector("#searchInput");
const headerSearchInput = document.querySelector("#headerSearchInput");
const quickCategoryGrid = document.querySelector("#quickCategoryGrid");
const catalogDirectory = document.querySelector("#catalogDirectory");
const recentlyViewedSection = document.querySelector("#recentlyViewed");
const recentlyViewedRow = document.querySelector("#recentlyViewedRow");
const freshProductsSection = document.querySelector("#freshProducts");
const freshProductsRow = document.querySelector("#freshProductsRow");
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
const myOrdersForm = document.querySelector("#myOrdersForm");
const myOrdersStatus = document.querySelector("#myOrdersStatus");
const myOrdersResults = document.querySelector("#myOrdersResults");
const myOrdersLookupResults = document.querySelector("#myOrdersLookupResults");
const myOrdersAccount = document.querySelector("#myOrdersAccount");
const cabinetLoginCard = document.querySelector("#cabinetLoginCard");
const myOrdersLogoutButton = document.querySelector("#myOrdersLogoutButton");
const myOrdersLoginForm = document.querySelector("#myOrdersLoginForm");
const myOrdersLoginStatus = document.querySelector("#myOrdersLoginStatus");
const myOrdersOtpForm = document.querySelector("#myOrdersOtpForm");
const myOrdersOtpStatus = document.querySelector("#myOrdersOtpStatus");
const myOrdersFallback = document.querySelector("#myOrdersFallback");
const openCartButton = document.querySelector("#openCart");
const floatingCartButton = document.querySelector("#floatingCart");
const floatingCartCount = document.querySelector("#floatingCartCount");
const backToTopButton = document.querySelector("#backToTop");
const repeatLastOrderButton = document.querySelector("#repeatLastOrder");
const productModal = document.querySelector("#productModal");
const productModalContent = document.querySelector("#productModalContent");
const modalTopActions = document.querySelector("#modalTopActions");
const customerCardTitle = document.querySelector("#customerCardTitle");
const customerCardText = document.querySelector("#customerCardText");
const cabinetGreetingName = document.querySelector("#cabinetGreetingName");
const cabinetAvatarInitial = document.querySelector("#cabinetAvatarInitial");
const cabinetPhone = document.querySelector("#cabinetPhone");
const cabinetNotificationButton = document.querySelector("#cabinetNotificationButton");
const cabinetNotificationBadge = document.querySelector("#cabinetNotificationBadge");
const cabinetNotifications = document.querySelector("#cabinetNotifications");
const cabinetNotificationList = document.querySelector("#cabinetNotificationList");
const profileForm = document.querySelector("#profileForm");
const profileStatus = document.querySelector("#profileStatus");
const wholesaleStatusText = document.querySelector("#wholesaleStatusText");
const wholesaleForm = document.querySelector("#wholesaleForm");
const wholesaleStatus = document.querySelector("#wholesaleStatus");
const contactForm = document.querySelector("#contactForm");
const contactStatus = document.querySelector("#contactStatus");
const siteHeader = document.querySelector(".site-header");
const toggleSearchButton = document.querySelector("#toggleSearch");
const toggleMenuButton = document.querySelector("#toggleMenu");
const categoryMenu = document.querySelector("#categoryMenu");
const hero = document.querySelector(".hero");
const heroTrack = document.querySelector("#heroTrack");
const heroDots = document.querySelector("#heroDots");
const heroPrevButton = document.querySelector("#heroPrev");
const heroNextButton = document.querySelector("#heroNext");
const mobileBottomNav = document.querySelector("#mobileBottomNav");
const bottomNavHomeLink = document.querySelector("#bottomNavHome");
const bottomNavCatalogLink = document.querySelector("#bottomNavCatalog");
const bottomNavFavoritesLink = document.querySelector("#bottomNavFavorites");
const bottomNavCartLink = document.querySelector("#bottomNavCart");
const bottomNavCabinetLink = document.querySelector("#bottomNavCabinet");
const bottomNavFavoritesCount = document.querySelector("#bottomNavFavoritesCount");
const bottomNavCartCount = document.querySelector("#bottomNavCartCount");
let activeZoomImage = null;

let recentlyViewedIds = loadRecentlyViewed();
let favoriteIds = new Set(loadFavorites());

let siteConfig = {};
let searchSynonymGroups = [];
let ignoredSearchDraftTerms = [];
let searchBrandAliases = {};

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
  { title: "Стирка", category: "Стирка и уход за бельем", image: "assets/category-icons/laundry-generic.png" },
  { title: "Детское", audience: "kids", image: "assets/category-icons/kids-generic.png" },
  { title: "Европа", collection: "europe", image: "assets/category-icons/europe-generic.png" },
  { title: "Бритье", category: "Бритье", image: "assets/category-icons/shaving-generic.png" },
  { title: "Дезодоранты", category: "Дезодоранты", image: "assets/category-icons/deodorants-generic.png" },
  { title: "Волосы", category: "Уход за волосами", image: "assets/category-icons/hair-generic.png" },
  { title: "Чистка", category: "Уборка и чистота", image: "assets/category-icons/cleaning-generic.png" },
  { title: "Парфюм", category: "Парфюм 5 мл", image: "assets/category-icons/perfume-generic.png" },
  { title: "Кремы", category: "Уход за телом", query: "крем", image: "assets/category-icons/creams-generic.png" },
  { title: "Тело", category: "Уход за телом", image: "assets/category-icons/body-generic.png" },
  { title: "Зубы", category: "Зубная гигиена", image: "assets/category-icons/oral-generic.png" },
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
    searchBrandAliases = config.brandAliases && typeof config.brandAliases === "object" ? config.brandAliases : {};
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
  return Boolean(state.session);
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
  const customer = state.session;
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

function resolveBrandFromQuery(normalizedQuery) {
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  for (const canonicalBrand of Object.keys(searchBrandAliases)) {
    const aliases = (searchBrandAliases[canonicalBrand] || []).map(normalizeSearchValue).filter(Boolean);
    const candidates = [normalizeSearchValue(canonicalBrand), ...aliases];
    const matched = candidates.some((alias) => {
      if (!alias) return false;
      if (normalizedQuery === alias) return true;
      if (!alias.includes(" ")) return queryTokens.includes(alias);
      return normalizedQuery.includes(alias);
    });
    if (matched) return canonicalBrand;
  }
  return "";
}

function resolveMatchedSynonymGroups(normalizedQuery) {
  return searchSynonymGroups.filter((group) => groupMatchesQuery(group, normalizedQuery));
}

function resolveExpectedKinds(matchedGroups, normalizedQuery) {
  const kinds = new Set();
  matchedGroups.forEach((group) => {
    const aliasKinds = group.aliasKinds || {};
    let usedAliasKind = false;
    Object.keys(aliasKinds).forEach((alias) => {
      if (normalizeSearchValue(alias) && normalizedQuery.includes(normalizeSearchValue(alias))) {
        (aliasKinds[alias] || []).forEach((kind) => kinds.add(kind));
        usedAliasKind = true;
      }
    });
    if (!usedAliasKind) {
      (group.productKinds || []).forEach((kind) => kinds.add(kind));
    }
  });
  return kinds;
}

function buildSearchContext(normalizedQuery) {
  if (!normalizedQuery) return null;
  const matchedGroups = resolveMatchedSynonymGroups(normalizedQuery);
  const expectedKinds = resolveExpectedKinds(matchedGroups, normalizedQuery);
  const expectedCategoryIds = new Set(matchedGroups.flatMap((group) => group.categoryIds || []));
  const expectedCategories = new Set(matchedGroups.flatMap((group) => group.categories || []));
  const expectedBrand = resolveBrandFromQuery(normalizedQuery);
  return { normalizedQuery, expectedKinds, expectedCategoryIds, expectedCategories, expectedBrand };
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

  const expectedBrand = resolveBrandFromQuery(normalizedQuery);
  if (expectedBrand && normalizeSearchValue(product.brand) === normalizeSearchValue(expectedBrand)) return true;

  return searchSynonymGroups.some((group) => groupMatchesQuery(group, normalizedQuery) && productMatchesSynonymGroup(product, group, text));
}

function searchRelevanceScore(product, context) {
  if (!context) return 0;
  const { normalizedQuery, expectedKinds, expectedCategoryIds, expectedCategories, expectedBrand } = context;
  const normTitle = normalizeSearchValue(product.title);
  const normBrand = normalizeSearchValue(product.brand);
  let score = 0;

  if (normTitle === normalizedQuery) score += 1000;
  else if (normTitle.startsWith(`${normalizedQuery} `)) score += 400;

  if (expectedBrand && normBrand === normalizeSearchValue(expectedBrand)) score += 500;
  else if (normBrand === normalizedQuery) score += 500;

  const titleTokens = normTitle.split(" ").filter(Boolean);
  if (titleTokens.includes(normalizedQuery)) score += 150;

  if (expectedKinds.size && product.productKind && expectedKinds.has(product.productKind)) score += 300;

  if (expectedCategoryIds.size && expectedCategoryIds.has(product.categoryId)) score += 120;
  else if (expectedCategories.size && expectedCategories.has(product.category)) score += 120;

  if (hasProductImage(product)) score += 8;
  if (product.status === "active") score += 5;

  const normProductType = normalizeSearchValue(product.productType);
  if (normTitle.includes(normalizedQuery) || normBrand.includes(normalizedQuery) || normProductType.includes(normalizedQuery)) {
    score += 60;
  } else if ((product.searchTerms || []).some((term) => normalizeSearchValue(term) === normalizedQuery)) {
    score += 40;
  } else {
    score += 5;
  }

  return score;
}

function compareBySearchRelevance(a, b, context) {
  const diff = searchRelevanceScore(b, context) - searchRelevanceScore(a, context);
  if (diff) return diff;
  return featuredProductCompare(a, b);
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
  if (!checkoutForm || !state.session) return;
  if (!checkoutForm.elements.name.value && state.session.name) checkoutForm.elements.name.value = state.session.name;
  if (!checkoutForm.elements.phone.value && state.session.phone) checkoutForm.elements.phone.value = state.session.phone;
}

// The checkout section's "Клиентская цена" card is a CTA to the SMS login in
// #myOrders, not a form of its own — there's only one login/registration
// flow in this storefront. See index.html #checkout .customer-card and
// docs/api-orders.md "Unified customer identity".
function renderClientPriceCta() {
  const registered = isRegisteredCustomer();
  if (customerCardTitle) {
    customerCardTitle.textContent = registered
      ? "Клиентская цена применена"
      : "Войдите по телефону для клиентской цены";
  }
  if (customerCardText) {
    customerCardText.textContent = registered
      ? `Вам применена клиентская цена (скидка ${catalogSettings.default_registered_discount_percent}% от розничной).`
      : `Вход по SMS-коду открывает клиентскую цену (скидка ${catalogSettings.default_registered_discount_percent}%), историю заказов и личный кабинет — без пароля и отдельной регистрации.`;
  }
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
  latestStockDate = String(catalog.latestStockDate || "").slice(0, 10);
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
  renderClientPriceCta();
  renderQuickCategories(catalog.categories || []);
  renderCategories();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderFreshProducts();
  renderRecentlyViewed();
  renderProducts();
  renderCart();
  applyCatalogParamsFromUrl();
  applyBottomNavParamsFromUrl();
  openSharedProductFromUrl();
}

// Lets the bottom nav's Избранное/Корзина links work as plain <a href> from
// a product page (a different document — no shared JS state to intercept
// with), by finishing the action once the homepage itself has loaded.
function applyBottomNavParamsFromUrl() {
  const params = mergedUrlParams();
  if (params.get("favorites") === "1") {
    state.favoriteOnly = true;
    renderFavoriteFilter();
    renderProducts();
    if (window.location.hash.includes("catalog")) {
      document.querySelector("#catalog")?.scrollIntoView({ behavior: "auto" });
    }
  }
  if (params.get("openCart") === "1") {
    setCartOpen(true);
  }
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
        card.audience ? `data-audience="${escapeHtml(card.audience)}"` : "",
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
  const matchesAudience = !item.audience || product.audience === item.audience;
  const matchesCollection = !item.collection || productMatchesCollection(product, item.collection);
  const matchesQuery = !item.query || productMatchesSearchQuery(product, item.query);
  return matchesCategory && matchesAudience && matchesCollection && matchesQuery;
}

function countProductsForShortcut(item, countByCategory = new Map()) {
  if (!item.category && !item.audience && !item.collection && !item.query) return "";
  if (item.category === "Все") return products.length;
  if (item.category && !item.audience && !item.collection && !item.query) return countByCategory.get(item.category) || 0;
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
  const count = products.filter((product) => favoriteIds.has(product.id)).length;
  if (favoriteFilterButton) {
    favoriteFilterButton.classList.toggle("active", state.favoriteOnly);
    favoriteFilterButton.setAttribute("aria-pressed", String(state.favoriteOnly));
    favoriteFilterButton.textContent = state.favoriteOnly ? `♥ Избранное (${count})` : `♡ Избранное${count ? ` (${count})` : ""}`;
  }
  if (bottomNavFavoritesCount) {
    bottomNavFavoritesCount.textContent = String(count);
    bottomNavFavoritesCount.hidden = count === 0;
  }
  bottomNavFavoritesLink?.classList.toggle("active", state.favoriteOnly);
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
      const isActive = (item.category && state.category === item.category && !state.collection && !state.audience)
        || (item.audience && state.audience === item.audience)
        || (item.collection && state.collection === item.collection);
      const attributes = [
        item.category ? `data-category="${escapeHtml(item.category)}"` : "",
        item.audience ? `data-audience="${escapeHtml(item.audience)}"` : "",
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
  state.audience = "";
  state.audienceLabel = "";
  state.query = "";
  state.label = "";
  state.collection = "";
  state.collectionLabel = "";
  state.favoriteOnly = false;
  state.visibleLimit = 60;
  searchInput.value = "";
  headerSearchInput.value = "";
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderProducts();
}

function selectQuery(query, label = "") {
  state.category = "Все";
  state.audience = "";
  state.audienceLabel = "";
  state.query = query;
  state.label = label;
  state.collection = "";
  state.collectionLabel = "";
  state.favoriteOnly = false;
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderProducts();
}

function selectCategoryQuery(category, query, label = "") {
  state.category = category;
  state.audience = "";
  state.audienceLabel = "";
  state.query = query;
  state.label = label;
  state.collection = "";
  state.collectionLabel = "";
  state.favoriteOnly = false;
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderProducts();
}

function selectCollection(collection, label = "") {
  state.category = "Все";
  state.audience = "";
  state.audienceLabel = "";
  state.query = "";
  state.label = "";
  state.collection = collection;
  state.collectionLabel = label || displayCollectionName(collection);
  state.favoriteOnly = false;
  state.visibleLimit = 60;
  searchInput.value = "";
  headerSearchInput.value = "";
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderProducts();
}

function selectCollectionQuery(collection, query, label = "") {
  state.category = "Все";
  state.audience = "";
  state.audienceLabel = "";
  state.query = query;
  state.label = label || query;
  state.collection = collection;
  state.collectionLabel = displayCollectionName(collection);
  state.favoriteOnly = false;
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderProducts();
}

function selectAudience(audience, label = "", query = "") {
  state.category = "Все";
  state.audience = audience;
  state.audienceLabel = label || audience;
  state.query = query;
  state.label = query ? label || query : "";
  state.collection = "";
  state.collectionLabel = "";
  state.favoriteOnly = false;
  state.visibleLimit = 60;
  searchInput.value = query;
  headerSearchInput.value = query;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderFavoriteFilter();
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
  const audience = params.get("audience");
  const query = params.get("q") || params.get("query");
  const label = params.get("label") || "";

  if (audience) {
    selectAudience(audience, label || (audience === "kids" ? "Детское" : audience), query || "");
  } else if (collection && query) {
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
  if (state.audience) {
    parts.push({ title: state.audienceLabel || state.audience, audience: state.audience });
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
        : part.audience
          ? `data-audience="${escapeHtml(part.audience)}" data-label="${escapeHtml(part.title)}"`
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
    const matchesAudience = !state.audience || product.audience === state.audience;
    const matchesCollection = productMatchesCollection(product, state.collection);
    const matchesPrice = productPrice(product) <= state.maxPrice;
    const matchesQuery = productMatchesSearchQuery(product, normalizedQuery);
    return matchesFavorite && matchesCategory && matchesAudience && matchesCollection && matchesPrice && matchesQuery;
  });

  const searchContext = state.sort === "featured" && normalizedQuery ? buildSearchContext(normalizedQuery) : null;
  const sorted = filtered.sort((a, b) => {
    if (state.sort === "price-asc") return productPrice(a) - productPrice(b);
    if (state.sort === "price-desc") return productPrice(b) - productPrice(a);
    if (searchContext) return compareBySearchRelevance(a, b, searchContext);
    return featuredProductCompare(a, b);
  });

  if (state.sort === "featured" && state.category === "Все" && !state.audience && !state.collection && !normalizedQuery) {
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

function freshProductGroup(product) {
  const text = `${product.productType || ""} ${product.title || ""} ${product.categoryId || ""}`.toLowerCase();
  if (/порош/.test(text)) return "01-powder";
  if (/шампун/.test(text)) return "02-shampoo";
  if (/дезодорант|антиперспирант|\bстик\b/.test(text)) return "03-deodorant";
  if (/зубн.*щ[её]тк|щ[её]тк.*зубн/.test(text)) return "04-toothbrush";
  return `10-${product.productType || product.categoryId || "other"}`.toLowerCase();
}

// Only stable 1C identities first seen in the latest stock export are fresh.
// Round-robin by product type gives shoppers a broad overview instead of a
// row filled with variants of one shampoo or detergent.
function freshProducts(limit = 16) {
  if (!latestStockDate) return [];
  const eligible = products.filter((product) =>
    product.status === "active"
    && String(product.firstSeenAt || "").slice(0, 10) === latestStockDate
  );
  const ranked = eligible.slice().sort((a, b) => {
    const imageScore = Number(hasProductImage(b)) - Number(hasProductImage(a));
    if (imageScore) return imageScore;
    const ratingScore = Number(b.rating || 0) - Number(a.rating || 0);
    if (ratingScore) return ratingScore;
    return a.title.localeCompare(b.title, "ru");
  });
  const buckets = new Map();
  for (const product of ranked) {
    const key = freshProductGroup(product);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(product);
  }
  const keys = [...buckets.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  const picked = [];
  while (picked.length < limit) {
    let added = false;
    for (const key of keys) {
      const product = buckets.get(key)?.shift();
      if (!product) continue;
      picked.push(product);
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
  }
  return picked;
}

function renderFreshProducts() {
  if (!freshProductsSection || !freshProductsRow) return;
  const items = freshProducts();
  freshProductsSection.hidden = items.length === 0;
  if (!items.length) {
    freshProductsRow.innerHTML = "";
    return;
  }

  freshProductsRow.innerHTML = items
    .map((product) => {
      const display = productDisplayParts(product);
      const href = hasProductPage(product) ? productPageUrl(product) : "";
      const imageAction = href
        ? `href="${escapeHtml(href)}" data-product-link="${product.id}"`
        : `href="#" data-fresh-open="${product.id}"`;
      return `
        <article class="fresh-product recent-product">
          <a class="recent-product-image" ${imageAction} aria-label="Открыть ${escapeHtml(product.title)}">
            <div class="fresh-product-badge">Новинка</div>
            <img class="${hasProductImage(product) ? "" : "fallback-image"}" src="${escapeHtml(productCardImage(product))}" alt="${escapeHtml(product.title)}" loading="lazy">
            <span>${escapeHtml(display.brand)}</span>
          </a>
          <a class="recent-product-copy" ${imageAction}>
            <strong>${escapeHtml(display.type)}</strong>
            <small>${escapeHtml(display.size || product.unit || "")}</small>
          </a>
          <div class="recent-product-action">
            <span>${formatPriceHtml(productPrice(product))}</span>
            <button type="button" data-fresh-add="${product.id}" aria-label="Добавить ${escapeHtml(product.title)} в корзину">+</button>
          </div>
        </article>
      `;
    })
    .join("");
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
              <span class="product-brand-line">
                <span class="product-brand-name">${escapeHtml(display.brand)}</span>
                ${display.size ? `<span class="product-size-line">${escapeHtml(display.size)}</span>` : ""}
              </span>
              <span class="product-kind-line">
                <strong>${escapeHtml(display.type)}</strong>
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
                  ? `Клиентская цена: скидка ${catalogSettings.default_registered_discount_percent}%`
                  : `Цена при входе: ${formatPriceHtml(product.registeredPriceKgs)}`
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
              ? `Клиентская цена: скидка ${catalogSettings.default_registered_discount_percent}%`
              : `Цена при входе: ${formatPriceHtml(product.registeredPriceKgs)}`
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
  if (bottomNavCartCount) {
    bottomNavCartCount.textContent = String(totalCount);
    bottomNavCartCount.hidden = totalCount === 0;
  }
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
  bottomNavCartLink?.classList.toggle("active", isOpen);
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
  const cabinetSection = document.querySelector("#myOrders");
  const cabinetTop = cabinetSection ? window.scrollY + cabinetSection.getBoundingClientRect().top : Infinity;
  const cabinetVisible = window.scrollY >= cabinetTop - 80;
  const shouldShow = window.scrollY > 900
    && !cabinetVisible
    && !cartDrawer.classList.contains("open")
    && !productModal.classList.contains("open");
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
  updateBottomNavActiveSection();
  headerScrollTicking = false;
}

// Lightweight scroll-spy for Главная/Каталог/Кабинет — Избранное/Корзина
// have their own active state (state.favoriteOnly / cart drawer open) set
// where they're toggled, not from scroll position.
function updateBottomNavActiveSection() {
  if (!mobileBottomNav) return;
  const catalogSection = document.querySelector("#catalog");
  const cabinetSection = document.querySelector("#myOrders");
  if (!catalogSection || !cabinetSection) return;
  const probeY = window.scrollY + window.innerHeight * 0.3;
  const catalogTop = window.scrollY + catalogSection.getBoundingClientRect().top;
  const cabinetTop = window.scrollY + cabinetSection.getBoundingClientRect().top;
  let current = bottomNavHomeLink;
  if (probeY >= cabinetTop) {
    current = bottomNavCabinetLink;
  } else if (probeY >= catalogTop) {
    current = bottomNavCatalogLink;
  }
  [bottomNavHomeLink, bottomNavCatalogLink, bottomNavCabinetLink].forEach((link) => {
    link?.classList.toggle("active", link === current);
  });
}

function requestSmartHeaderUpdate() {
  if (headerScrollTicking) return;
  headerScrollTicking = true;
  window.requestAnimationFrame(updateSmartHeader);
}

// A short, easy-to-read/type code the customer can use later on /orders/ to
// look up their order history — no account needed. Generated client-side (not
// derived from the DB order id, which does not exist yet at this point) and
// sent to the server as payload.lookup_code; delivered to the customer for
// free because it rides along inside the WhatsApp message they already send
// (see orderMessage below) and in the manager's WhatsApp confirmation reply.
// Alphabet excludes 0/O and 1/I to avoid misreads.
const ORDER_LOOKUP_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generateOrderLookupCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ORDER_LOOKUP_CODE_ALPHABET[Math.floor(Math.random() * ORDER_LOOKUP_CODE_ALPHABET.length)];
  }
  return code;
}

function orderMessage(formData, lookupCode) {
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
    `Код заказа (для раздела "Мои заказы" на сайте): ${lookupCode}`,
    "",
    `Клиент: ${formData.get("name")}`,
    `Телефон/WhatsApp: ${formData.get("phone")}`,
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
  const shortcut = event.target.closest(".quick-category");
  if (!shortcut) return;
  const label = shortcut.dataset.label || "";
  if (shortcut.dataset.audience) {
    selectAudience(shortcut.dataset.audience, label, shortcut.dataset.query || "");
  } else if (shortcut.dataset.category && shortcut.dataset.query) {
    selectCategoryQuery(shortcut.dataset.category, shortcut.dataset.query, label);
  } else if (shortcut.dataset.collection) {
    selectCollection(shortcut.dataset.collection, label);
  } else if (shortcut.dataset.query) {
    selectQuery(shortcut.dataset.query, label);
  } else {
    selectCategory(shortcut.dataset.category);
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

freshProductsRow?.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-fresh-add]");
  const productLink = event.target.closest("[data-product-link]");
  const openButton = event.target.closest("[data-fresh-open]");
  if (addButton) {
    addToCart(addButton.dataset.freshAdd);
    showAddFeedback(addButton);
    return;
  }
  if (productLink) {
    recordRecentlyViewed(productLink.dataset.productLink);
    return;
  }
  if (openButton) {
    event.preventDefault();
    openProductModal(openButton.dataset.freshOpen);
  }
});

catalogDirectory?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.query) {
    selectQuery(button.dataset.query, button.dataset.label || button.dataset.query);
  } else if (button.dataset.audience) {
    selectAudience(button.dataset.audience, button.dataset.label || button.dataset.audience);
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
  const button = event.target.closest("[data-category], [data-audience], [data-collection], [data-query]");
  if (!button) return;
  if (button.dataset.audience) {
    selectAudience(button.dataset.audience, button.dataset.label || button.dataset.audience, button.dataset.query || "");
  } else if (button.dataset.query && button.dataset.category) {
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

// Bottom nav: progressive enhancement. Every link already has a real href
// (/#catalog, /?favorites=1#catalog, /?openCart=1#top, /#myOrders) so it
// works unassisted from a product page (a different document, no app.js
// state to intercept with). On the homepage itself we intercept the click
// to act in place — no reload, reuses the existing filter/drawer/scroll
// behavior other nav entries already use.
function scrollToSection(selector) {
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
}

// "Главная" / logo: reset to the clean home view (no leftover category or
// favorites filter) and scroll to the very top. Plain <a href="/#top"> would
// otherwise land at the fixed-header offset, leaving the page looking a bit
// scrolled down.
function goHomeTop(event) {
  if (!document.querySelector("#catalog")) return; // not the homepage → let the link navigate
  event.preventDefault();
  selectCategory("Все"); // also clears favoriteOnly / query / collection
  window.scrollTo({ top: 0, behavior: "smooth" });
}

bottomNavHomeLink?.addEventListener("click", goHomeTop);
document.querySelectorAll(".brand, .footer-brand").forEach((el) => el.addEventListener("click", goHomeTop));

bottomNavCatalogLink?.addEventListener("click", (event) => {
  if (!document.querySelector("#catalog")) return;
  event.preventDefault();
  // "Каталог" always shows the full catalog — turn off a lingering favorites
  // filter so the user isn't stuck on an empty/short favorites list.
  if (state.favoriteOnly) {
    state.favoriteOnly = false;
    state.visibleLimit = 60;
    renderFavoriteFilter();
    renderProducts();
  }
  scrollToSection("#catalog");
});

bottomNavFavoritesLink?.addEventListener("click", (event) => {
  if (!document.querySelector("#catalog")) return;
  event.preventDefault();
  const enabling = !state.favoriteOnly;
  if (enabling) {
    // Show favorites across the whole catalog, not filtered by whatever
    // category/collection/search happened to be active.
    state.category = "Все";
    state.audience = "";
    state.audienceLabel = "";
    state.query = "";
    state.label = "";
    state.collection = "";
    state.collectionLabel = "";
    if (searchInput) searchInput.value = "";
    if (headerSearchInput) headerSearchInput.value = "";
  }
  state.favoriteOnly = enabling;
  state.visibleLimit = 60;
  renderCategories();
  renderCategoryMenu();
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderProducts();
  if (enabling) scrollToSection("#catalog");
});

bottomNavCartLink?.addEventListener("click", (event) => {
  if (!cartDrawer) return;
  event.preventDefault();
  setCartOpen(true);
});

function scrollCabinetToTop(behavior = "smooth") {
  const cabinetSection = document.querySelector("#myOrders");
  if (!cabinetSection) return;
  const top = window.scrollY + cabinetSection.getBoundingClientRect().top;
  window.scrollTo({ top, behavior });
}

bottomNavCabinetLink?.addEventListener("click", (event) => {
  const cabinetSection = document.querySelector("#myOrders");
  if (!cabinetSection) return;
  event.preventDefault();
  scrollCabinetToTop();
});

if (window.location.hash === "#myOrders") {
  window.addEventListener("load", () => requestAnimationFrame(() => scrollCabinetToTop("auto")), { once: true });
}

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
  state.favoriteOnly = false;
  headerSearchInput.value = state.query;
  state.visibleLimit = 60;
  renderCatalogDirectory();
  renderFavoriteFilter();
  renderProducts();
});

headerSearchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.label = "";
  state.favoriteOnly = false;
  searchInput.value = state.query;
  state.visibleLimit = 60;
  renderCatalogDirectory();
  renderFavoriteFilter();
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
const checkoutForm = document.querySelector("#checkoutForm");

document.querySelector("#checkoutLink").addEventListener("click", (event) => {
  event.preventDefault();
  setCartOpen(false);
  window.history.replaceState(null, "", "#checkoutForm");
  checkoutForm.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    const firstEmptyRequired = [...checkoutForm.querySelectorAll("input[required]")]
      .find((input) => !input.value.trim());
    (firstEmptyRequired || checkoutForm.querySelector("input"))?.focus({ preventScroll: true });
  }, 350);
});

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

function buildOrderPayload(formData, message, lookupCode) {
  return {
    customer: {
      name: formData.get("name"),
      phone: formData.get("phone"),
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
    lookup_code: lookupCode,
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
    const lookupCode = generateOrderLookupCode();
    const message = orderMessage(formData, lookupCode);
    let whatsapp = `https://wa.me/${catalogSettings.manager_whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    // Save the guest order first. The API also emails the manager; WhatsApp
    // remains the customer-facing continuation and the no-backend fallback.
    const saved = await saveOrderViaApi(buildOrderPayload(formData, message, lookupCode));
    if (saved && saved.manager_whatsapp_url) whatsapp = saved.manager_whatsapp_url;
    saveLastOrder();
    formStatus.innerHTML = saved
      ? `Заказ отправлен менеджеру. Открываем WhatsApp для связи. Если он не открылся, <a href="${whatsapp}" target="_blank" rel="noreferrer">нажмите здесь</a>.`
      : `Открываем WhatsApp для отправки заказа менеджеру. Если он не открылся, <a href="${whatsapp}" target="_blank" rel="noreferrer">нажмите здесь</a>.`;
    window.location.href = whatsapp;
  } finally {
    checkoutSubmitting = false;
    if (submitButton) submitButton.disabled = false;
  }
});

// "Мои заказы" — no account/login: proof of ownership is phone + the code
// from the WhatsApp message/confirmation (see generateOrderLookupCode above
// and functions/api/customer-orders.js). Pure rendering split out from the
// submit handler so the markup shape is easy to eyeball/test.
function myOrderCardHtml(order) {
  const items = (order.items || [])
    .map((item) => `<li><span>${escapeHtml(item.title || "Товар")}</span><span>${item.qty} × ${formatPrice(item.price_kgs)}</span></li>`)
    .join("");
  const created = order.created_at ? new Date(order.created_at).toLocaleDateString("ru-RU") : "";
  const itemCount = (order.items || []).reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
  const details = [order.address, order.customer_comment].filter(Boolean);
  return `
    <details class="my-order-card">
      <summary>
        <span class="my-order-summary-main">
          <strong>${escapeHtml(created || "Заказ")}</strong>
          <small>${itemCount} ${itemCount === 1 ? "товар" : "товаров"} · ${escapeHtml(order.status_label || order.status || "")}</small>
        </span>
        <span class="my-order-card-total">${formatPrice(order.total_kgs)}</span>
      </summary>
      <div class="my-order-card-details">
        <span class="my-order-card-code">Заказ ${escapeHtml(order.code || "")}</span>
        <ul class="my-order-card-items">${items}</ul>
        ${details.length ? `<p>${details.map((value) => escapeHtml(value)).join(" · ")}</p>` : ""}
      </div>
    </details>
  `;
}

function renderMyOrders(orders, { emptyState = false, target = myOrdersResults } = {}) {
  if (!target) return;
  if (!orders || !orders.length) {
    if (emptyState) {
      target.hidden = false;
      target.innerHTML = `
        <div class="my-orders-empty">
          <p>У вас пока нет заказов.</p>
          <a class="secondary-link" href="#catalog">В каталог</a>
        </div>
      `;
    } else {
      target.hidden = true;
      target.innerHTML = "";
    }
    return;
  }
  target.hidden = false;
  target.innerHTML = orders.map(myOrderCardHtml).join("");
}

myOrdersForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!myOrdersStatus) return;
  const formData = new FormData(event.currentTarget);
  const phone = formData.get("lookupPhone");
  const code = formData.get("lookupCode");
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  myOrdersStatus.textContent = "Ищем ваши заказы…";
  renderMyOrders(null, { target: myOrdersLookupResults });
  try {
    const res = await fetch("/api/customer-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok && Array.isArray(data.orders) && data.orders.length) {
      myOrdersStatus.textContent = `Найдено заказов: ${data.orders.length}`;
      renderMyOrders(data.orders, { target: myOrdersLookupResults });
    } else {
      myOrdersStatus.textContent = "Заказы не найдены. Проверьте телефон и код заказа.";
      renderMyOrders(null, { target: myOrdersLookupResults });
    }
  } catch {
    myOrdersStatus.textContent = "Не получилось проверить заказы. Попробуйте ещё раз или напишите менеджеру в WhatsApp.";
    renderMyOrders(null, { target: myOrdersLookupResults });
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

// "Мои заказы" — SMS-OTP login (functions/api/auth/request-otp.js,
// functions/api/auth/verify-otp.js). The session itself lives in an
// HttpOnly cookie the browser can't read, so "am I logged in" is answered by
// asking /api/customer-orders with an empty body: a valid session cookie
// makes it return the full order history; no session/expired falls back to
// its normal phone+code validation and answers 400.
function otpRequestErrorMessage(error) {
  switch (error) {
    case "invalid_phone":
      return "Проверьте номер телефона.";
    case "sms_provider_unavailable":
      return "Сервис SMS временно недоступен. Попробуйте позже или напишите менеджеру в WhatsApp.";
    case "backend_not_configured":
      return "Вход по SMS временно недоступен.";
    default:
      return "Не получилось отправить код. Попробуйте ещё раз.";
  }
}

function otpVerifyErrorMessage(error) {
  switch (error) {
    case "invalid_code":
      return "Неверный код. Проверьте SMS и попробуйте снова.";
    case "code_expired":
      return "Код устарел. Запросите новый.";
    case "invalid_token":
      return "Сессия входа устарела. Запросите код заново.";
    default:
      return "Не получилось войти. Попробуйте ещё раз.";
  }
}

let pendingOtpToken = null;

function showLoggedOutView() {
  if (myOrdersAccount) myOrdersAccount.hidden = true;
  if (cabinetLoginCard) cabinetLoginCard.hidden = false;
  if (myOrdersLoginForm) myOrdersLoginForm.hidden = false;
  if (myOrdersOtpForm) myOrdersOtpForm.hidden = true;
  if (myOrdersFallback) myOrdersFallback.hidden = false;
  if (myOrdersLoginStatus) myOrdersLoginStatus.textContent = "";
  if (myOrdersOtpStatus) myOrdersOtpStatus.textContent = "";
}

function showLoggedInView() {
  if (myOrdersAccount) myOrdersAccount.hidden = false;
  if (cabinetLoginCard) cabinetLoginCard.hidden = true;
  if (myOrdersLoginForm) myOrdersLoginForm.hidden = true;
  if (myOrdersOtpForm) myOrdersOtpForm.hidden = true;
  if (myOrdersFallback) myOrdersFallback.hidden = true;
  if (myOrdersLoginStatus) myOrdersLoginStatus.textContent = "";
  if (myOrdersOtpStatus) myOrdersOtpStatus.textContent = "";
}

// The single source of truth for "is this browser logged in" — an
// SMS-verified session (functions/api/customer-profile.js), never a locally
// typed "registration". Safe to call on every page; a 401 (not logged in)
// just resolves to null.
async function fetchCustomerProfile() {
  try {
    const res = await fetch("/api/customer-profile", { method: "GET" });
    const data = await res.json().catch(() => null);
    return data && data.ok ? data.profile : null;
  } catch {
    return null;
  }
}

async function refreshSession() {
  state.session = await fetchCustomerProfile();
  return state.session;
}

// Shared across every page that loads app.js, so a homepage visit doesn't
// fetch the session twice (once for #myOrders, once for catalog pricing).
let sessionPromise = null;
function ensureSession() {
  if (!sessionPromise) sessionPromise = refreshSession();
  return sessionPromise;
}

async function fetchMyOrdersSession() {
  try {
    const res = await fetch("/api/customer-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => null);
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

function renderCabinetProfile(profile) {
  if (!profileForm) return;
  profileForm.elements.name.value = profile?.name || "";
  profileForm.elements.phone.value = profile?.phone || "";
  profileForm.elements.address.value = profile?.address || "";
}

function renderWholesaleBlock(role) {
  if (!wholesaleStatusText || !wholesaleForm) return;
  if (role === "wholesale") {
    wholesaleStatusText.textContent = "У вас оптовый доступ.";
    wholesaleForm.hidden = true;
  } else if (role === "wholesale_pending") {
    wholesaleStatusText.textContent = "Заявка отправлена. Менеджер подтвердит доступ.";
    wholesaleForm.hidden = true;
  } else {
    wholesaleStatusText.textContent = "";
    wholesaleForm.hidden = false;
  }
}

function fillCabinetForms(profile) {
  if (wholesaleForm) wholesaleForm.elements.phone.value = profile?.phone || "";
  if (contactForm) {
    contactForm.elements.name.value = profile?.name || "";
    contactForm.elements.phone.value = profile?.phone || "";
  }
}

function renderCabinet(profile) {
  const role = profile?.role || "retail";
  const firstName = String(profile?.name || "").trim().split(/\s+/)[0] || "Клиент";
  if (cabinetGreetingName) cabinetGreetingName.textContent = firstName;
  if (cabinetAvatarInitial) cabinetAvatarInitial.textContent = firstName.slice(0, 1).toUpperCase();
  if (cabinetPhone) cabinetPhone.textContent = profile?.phone || "";
  renderCabinetProfile(profile);
  renderWholesaleBlock(role);
  fillCabinetForms(profile);
}

function renderCabinetNotifications(orders) {
  if (!cabinetNotificationList || !cabinetNotificationBadge) return;
  const recent = Array.isArray(orders) ? orders.slice(0, 3) : [];
  cabinetNotificationBadge.hidden = recent.length === 0;
  cabinetNotificationBadge.textContent = String(recent.length);
  cabinetNotificationList.innerHTML = recent.length
    ? recent.map((order) => {
        const date = order.created_at ? new Date(order.created_at).toLocaleDateString("ru-RU") : "";
        return `<p><strong>${escapeHtml(order.status_label || "Заказ принят")}</strong><span>${escapeHtml(date)} · ${formatPrice(order.total_kgs)}</span></p>`;
      }).join("")
    : '<p class="cabinet-hint">Новых уведомлений нет.</p>';
}

function refreshPricingViews() {
  renderClientPriceCta();
  renderProducts();
  renderRecentlyViewed();
  renderCart();
}

async function checkMyOrdersSession() {
  const profile = await ensureSession();
  if (profile) {
    showLoggedInView();
    renderCabinet(profile);
    const data = await fetchMyOrdersSession();
    const orders = data ? data.orders : null;
    renderMyOrders(orders, { emptyState: true });
    renderCabinetNotifications(orders);
  } else {
    showLoggedOutView();
  }
}

myOrdersLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!myOrdersLoginStatus) return;
  const formData = new FormData(event.currentTarget);
  const phone = formData.get("loginPhone");
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  myOrdersLoginStatus.textContent = "Отправляем код…";
  try {
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok && data.token) {
      pendingOtpToken = data.token;
      myOrdersLoginStatus.textContent = "Код отправлен по SMS.";
      if (myOrdersLoginForm) myOrdersLoginForm.hidden = true;
      if (myOrdersOtpForm) {
        myOrdersOtpForm.hidden = false;
        myOrdersOtpForm.querySelector("input[name='otpCode']")?.focus();
      }
    } else {
      myOrdersLoginStatus.textContent = otpRequestErrorMessage(data && data.error);
    }
  } catch {
    myOrdersLoginStatus.textContent = otpRequestErrorMessage(null);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

myOrdersOtpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!myOrdersOtpStatus) return;
  if (!pendingOtpToken) {
    myOrdersOtpStatus.textContent = otpVerifyErrorMessage("invalid_token");
    return;
  }
  const formData = new FormData(event.currentTarget);
  const code = formData.get("otpCode");
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  myOrdersOtpStatus.textContent = "Проверяем код…";
  try {
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: pendingOtpToken, code }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok) {
      pendingOtpToken = null;
      myOrdersOtpStatus.textContent = "";
      sessionPromise = null; // force a fresh session fetch — we just logged in
      await checkMyOrdersSession();
      refreshPricingViews();
    } else {
      myOrdersOtpStatus.textContent = otpVerifyErrorMessage(data && data.error);
    }
  } catch {
    myOrdersOtpStatus.textContent = otpVerifyErrorMessage(null);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

myOrdersLogoutButton?.addEventListener("click", async () => {
  myOrdersLogoutButton.disabled = true;
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Best-effort — the cookie is short-lived and the UI resets either way.
  }
  state.session = null;
  sessionPromise = null;
  renderMyOrders(null);
  renderCabinetNotifications(null);
  if (cabinetNotifications) cabinetNotifications.hidden = true;
  showLoggedOutView();
  myOrdersLoginForm?.reset();
  myOrdersOtpForm?.reset();
  myOrdersLogoutButton.disabled = false;
  refreshPricingViews();
});

cabinetNotificationButton?.addEventListener("click", () => {
  if (!cabinetNotifications) return;
  const opening = cabinetNotifications.hidden;
  cabinetNotifications.hidden = !opening;
  cabinetNotificationButton.setAttribute("aria-expanded", String(opening));
});

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profileStatus) return;
  const formData = new FormData(event.currentTarget);
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  profileStatus.textContent = "Сохраняем…";
  try {
    const res = await fetch("/api/customer-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        address: formData.get("address"),
      }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok) {
      state.session = data.profile;
      renderCabinet(data.profile);
      profileStatus.textContent = "Сохранено.";
      fillCheckoutFromCustomer();
    } else {
      profileStatus.textContent = "Не получилось сохранить. Попробуйте ещё раз.";
    }
  } catch {
    profileStatus.textContent = "Не получилось сохранить. Попробуйте ещё раз.";
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

wholesaleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!wholesaleStatus) return;
  const formData = new FormData(event.currentTarget);
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  wholesaleStatus.textContent = "Отправляем…";
  try {
    const res = await fetch("/api/wholesale-application", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: state.session?.name || formData.get("shop_name"),
        phone: formData.get("phone"),
        shop_name: formData.get("shop_name"),
        address: formData.get("address"),
      }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok) {
      wholesaleStatus.textContent = "Заявка отправлена. Менеджер подтвердит доступ.";
      wholesaleForm.hidden = true;
      if (state.session) {
        state.session = { ...state.session, role: "wholesale_pending" };
        renderWholesaleBlock("wholesale_pending");
      }
    } else {
      wholesaleStatus.textContent = "Не получилось отправить заявку. Попробуйте ещё раз или напишите менеджеру в WhatsApp.";
    }
  } catch {
    wholesaleStatus.textContent = "Не получилось отправить заявку. Попробуйте ещё раз или напишите менеджеру в WhatsApp.";
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!contactStatus) return;
  const formData = new FormData(event.currentTarget);
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  contactStatus.textContent = "Отправляем…";
  try {
    const res = await fetch("/api/contact-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        message: formData.get("message"),
      }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok) {
      contactStatus.textContent = "Сообщение отправлено. Мы свяжемся с вами.";
      event.currentTarget.elements.message.value = "";
    } else {
      contactStatus.textContent = "Не получилось отправить сообщение. Попробуйте ещё раз.";
    }
  } catch {
    contactStatus.textContent = "Не получилось отправить сообщение. Попробуйте ещё раз.";
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

// Only the homepage ships the "Мои заказы" section, but every page (product,
// category, homepage) needs to know login state for client pricing — both
// paths share the same in-flight request via ensureSession().
if (myOrdersAccount) {
  checkMyOrdersSession();
}

async function initStorefront() {
  await loadSiteConfig();
  await loadSearchSynonyms();
  updateSiteHeaderHeight();
  updateBackToTopButton();
  renderHeroBanners();
  startHeroRotation();
  await loadCatalog();
  await ensureSession();
  refreshPricingViews();
  updateBottomNavActiveSection();
}

initStorefront().catch((error) => {
  productGrid.innerHTML = `<p class="empty-cart">${escapeHtml(error.message)}</p>`;
});
