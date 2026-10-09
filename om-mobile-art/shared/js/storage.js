/**
 * OM Mobile Art — Storage Controller (storage.js)
 * Single source of truth for all mock data using localStorage.
 * Swap-ready: api.js wraps these methods so replacing with fetch() needs zero HTML/JS changes.
 *
 * Admin credentials: admin@omma.com / admin123
 * Shop  credentials: john@gmail.com / password123
 */

// ─── DEFAULT DATA ────────────────────────────────────────────────────────────

const DEFAULT_PRODUCTS = [];

const DEFAULT_COLLECTIONS = [
  { "id": 1, "name": "Anime Collection", "slug": "anime", "description": "Vibrant anime-inspired designs for enthusiasts.", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuAWZemF2MP94MBoM9Da5hPKQsIT9sA4Kw-eCGm_2jkW3e2lseyT3myJJvXUl6DvVdDhNXRXu2TbpcppeKwybD_4VUDSxRSPmS4wxsj76et2SLDtDJspAprAHPhg0p1EDRP873BilOjXHzddxHjgWbNUDIwdXZKFfHrq7R4NQMr8V9QgPoz9rNtDZaUShvwpUhLHUzSUFT2-pDqNZEVNww6BuOsooDLaXxEsLtLlD-AMTqsUKzd1OPf-LgHqjzjNqbpTpwye8m1sVwA" },
  { "id": 2, "name": "Marvel Edition", "slug": "marvel", "description": "Heroic Marvel-inspired designs with premium finishes.", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBYnPO-qED1PlSChAUTvBxzzE0ZSHz4uKkPUeahVzDftVi2s2RRI2Z5KUzQhvmjwrYS0celseczhC8vtZ-GCKTiFvPys52OtMDRG6LNfLp36QVjVdpJG4Dh0ejKgIdkINidq56I6JbD0KJ5gGDeN5O6nLJcbHRLka7jOHIGqQkTpvkgEOTaJePNydQSFhJCgoEkM-L2FGM6EGjThAO3J8DbLjWZ7CTR-9AFclHhBP5-oYVnCgDFDfzOXRBX6JlblaWUR_VF4K4lhvI" },
  { "id": 3, "name": "Gaming Gear", "slug": "gaming", "description": "Cyberpunk and gaming-themed neon skins.", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuA0PbpLjMq9NmPJL3YlGG_bakeGffy52nituv8DUQzUt1tTc_0hNduuk4VJI1gt8l9FeIGv1KLILZdeWv3gn5f7hl81sqlk4Q7NMRs7fg7G_M6_Q0CTPCtV24np0xfz5VUXCHLhHTXi8EqjjbylMeRmPHE5-ahjp0R_qbVR5_MnSpABd3nsLKBm3IUVgTV1Uq1SojhfiBIYZIosqAoArDPSjeDTCqcGtMrFd-CukY8MxRAMKyrm5fP7XHrof1bNFeJNPf7xAwC2EI0" },
  { "id": 4, "name": "Nature Series", "slug": "nature", "description": "Organic textures: marble, wood, and nature-inspired.", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuDUAr8QecGtUiFufrNv4A-cFZEcDq9C6brYs9yUc8mD7tWHFCzZSl-jmdRmtHpS2eIxYeEaL9iLf55v1e8afKwhmbtWLEvS6ow7KtIo0E8KlOeAD8zds3zONzkt_9MDC-L_VCSaOPH_p999h1ievpzaHLo1h43ye072lcmqOg3menlC0IrsO6fxMvniAp1NLw6qPFIJgbMb8YNP_Tt7IWk85PdXwB1DTlCsIbicUroIbcydsSnOAXsOc95_GV5rFslDxheQIcEp4_c" },
  { "id": 5, "name": "God Collection", "slug": "gods", "description": "Mythological gold-on-black ethereal designs.", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuD-V--0Nmn23T77DNjV7BMs8ft_JFe9evlZt33BQSwhJyOR5IXpIfAXtvsP5pL0w1UBiIHauC5TeyMhu_82fRRL164vmtO33SZX7G4kchHtpzQbvjEW267xV0fr_5AgKRVYwATL8PedzngSrGoqZb5JHZSLfynxeXxjmOslJktvj_vwGNmiUq2fBC_B2XO3X1HO5gq1ravIR7K0E-HQTvmij-1KmyXQiUu5nU1xW82oOM7tBlY6RyfOVHBhkKk9km3xCQbHrtLWqxk" },
  { "id": 6, "name": "Carbon Fiber", "slug": "carbon", "description": "Industrial carbon fiber precision aesthetics.", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuDAv3rLo5iLG3BkwTB6bd5h45wl3k20_Yh-ObG-kbCv0WChfhNAeHKmsCwQLcFOmu3mAfCdpWX3mEEgzSPPE75ckkAdlTQRTohxOfDpxgyynrpDH19a43Ci42B11nCAVRUyqbVyOpOX8xn2NxmO2M9dGGaatsJ8DJiKx1-VSXQjDb2TOW6b-r5udQal21I7sj4l3rTA0rITuBYQaKeElRylNc2eSdvsqyZjrGb_pl7w2cB-gJ61Q0aFe0i-8xxZU80sHSpMl8MhrfA" },
  { "id": 7, "name": "Luxury Series", "slug": "luxury", "description": "Exquisite textures crafted for premium look and feel.", "image": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop" },
  { "id": 8, "name": "Minimalist Solid", "slug": "minimal", "description": "Pure solid tones and minimal pastel textures.", "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop" },
  { "id": 9, "name": "Sports League", "slug": "sports", "description": "Athletic and high-adrenaline team spirit designs.", "image": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop" },
  { "id": 10, "name": "Festival Special", "slug": "festival", "description": "Colorful cultural drops celebrating global festivals.", "image": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop" }
];

const DEFAULT_BRANDS = [
  { "id": 1, "name": "Apple", "logo": "" },
  { "id": 2, "name": "Samsung", "logo": "" },
  { "id": 3, "name": "Google", "logo": "" },
  { "id": 4, "name": "OnePlus", "logo": "" },
  { "id": 5, "name": "Nothing", "logo": "" },
  { "id": 6, "name": "Asus", "logo": "" }
];

const DEFAULT_DEVICES = [
  { "id": 1, "name": "iPhone 16 Pro Max", "brand": "Apple" },
  { "id": 2, "name": "iPhone 16 Pro", "brand": "Apple" },
  { "id": 3, "name": "iPhone 15 Pro Max", "brand": "Apple" },
  { "id": 4, "name": "iPhone 15 Pro", "brand": "Apple" },
  { "id": 5, "name": "iPhone 15 Plus", "brand": "Apple" },
  { "id": 6, "name": "iPhone 15", "brand": "Apple" },
  { "id": 7, "name": "iPhone 14 Pro Max", "brand": "Apple" },
  { "id": 8, "name": "iPhone 13", "brand": "Apple" },
  { "id": 9, "name": "Samsung S24 Ultra", "brand": "Samsung" },
  { "id": 10, "name": "Samsung S24", "brand": "Samsung" },
  { "id": 11, "name": "Samsung S23 Ultra", "brand": "Samsung" },
  { "id": 12, "name": "Google Pixel 8 Pro", "brand": "Google" },
  { "id": 13, "name": "Google Pixel 8", "brand": "Google" },
  { "id": 14, "name": "Google Pixel 7 Pro", "brand": "Google" },
  { "id": 15, "name": "OnePlus 12", "brand": "OnePlus" },
  { "id": 16, "name": "OnePlus 11", "brand": "OnePlus" },
  { "id": 17, "name": "Nothing Phone 2", "brand": "Nothing" },
  { "id": 18, "name": "Asus ROG Phone 8", "brand": "Asus" }
];

const DEFAULT_USERS = [
  {
    "email": "john@gmail.com",
    "password": "password123",
    "name": "John Doe",
    "phone": "+91 96386 52327",
    "isAdmin": false,
    "addresses": [{ "id": 1, "firstName": "John", "lastName": "Doe", "street": "123 Premium Lane", "city": "Metropolis", "zip": "110001" }]
  },
  {
    "email": "admin@omma.com",
    "password": "admin123",
    "name": "Staff Administrator",
    "phone": "+91 99999 00000",
    "isAdmin": true,
    "addresses": [{ "id": 1, "firstName": "Admin", "lastName": "OM", "street": "OM HQ, Outer Ring Road", "city": "New Delhi", "zip": "110001" }]
  }
];

const DEFAULT_ORDERS = [
  { "id": "OM-1001", "date": "2026-07-01T12:00:00.000Z", "userEmail": "john@gmail.com", "items": [{ "id": 1, "name": "Stealth Black Skin", "price": 14.99, "qty": 1, "device": "iPhone 15 Pro Max", "finish": "Matte", "material": "Standard 3M", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCNxQr7LbDB90XpeIq66u1z8cx8DJZ4YwV-KFHEPbpyGwJU-xmOpBZEIJIcik9y7MX44YThGArd_8BHi42YP2I3iNu-vw5XUNXZdnrZpJnUgWjXYRQ6WpODbfW08Jp3S77XJ9i2_SmCJsjkBlo970SakiYKuNYAPLOA0l9_vf5zjDq_zg_7Lusrf3mHqmJxq--Yg8PUa8EQNkUrKhuGJNx9u9w50fPKvEwwOqGB2er3k4PuZeLfBYJe4--Up2EPJCrC5NX5mG3Objk" }], "subtotal": 14.99, "discount": 0.00, "shipping": 5.00, "tax": 0.00, "total": 19.99, "status": "Delivered", "paymentMethod": "Card", "shippingAddress": { "firstName": "John", "lastName": "Doe", "street": "123 Premium Lane", "city": "Metropolis", "zip": "110001" } },
  { "id": "OM-1002", "date": "2026-07-10T14:30:00.000Z", "userEmail": "john@gmail.com", "items": [{ "id": 4, "name": "Forged Carbon Skin", "price": 18.99, "qty": 2, "device": "iPhone 16 Pro", "finish": "Matte", "material": "Standard 3M", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuAccJqCkrJzAaYpo-B0G58KMceDxO3onxPjPo2eOOcqHZrN3jssx-1ydBzgi40P7mI6EIsu3U19SYP84FnAk8bxf8yg6afm07ixqlbwHpxboR1Ya9ECsguVozTlQVpSPSPCioVc7diS4m1bkdBvc3O5wu7MCWH2_OqukFzpMmWmrsqpVpzVB9BE6YGmOQteK7u3EWqnFhQ8c4_9UxyPJYesbVZJW0LJhYundApPJ50hopIZLqPDyajOE3uRU2CpDUj6aj1gonBidRM" }], "subtotal": 37.98, "discount": 3.79, "shipping": 0.00, "tax": 0.00, "total": 34.19, "status": "Printing", "paymentMethod": "UPI", "shippingAddress": { "firstName": "John", "lastName": "Doe", "street": "123 Premium Lane", "city": "Metropolis", "zip": "110001" } },
  { "id": "OM-1003", "date": "2026-07-12T09:15:00.000Z", "userEmail": "sara@example.com", "items": [{ "id": 7, "name": "Holographic Prism Skin", "price": 29.95, "qty": 1, "device": "Samsung S24 Ultra", "finish": "Gloss", "material": "Standard 3M", "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuCOYDDYcCliu5BzF9SaiQkgx83iHaNUfxKsgzGS72BiDkQgDzgrBKFYuHy0XwDoKlL7-eps1ZyVQx7mxvH6PGoYlcGnEHiV2a64HOb-4zD_-M25Fr-fLAwWgJ7VYRnT8Br6XJ5SNR5jC1s2c28ptYi9HktzpqIVDg6nsfWwF3BYXyPw1ZIb21rx47IPS-mCVrv9w3YeHcgk6Dh5VffY8D_0R4Kcu8K_wk_c4MjdAUIOPyUfqsBwTWU-qkhFM3pVQxjDktzDgqyEo8s" }], "subtotal": 29.95, "discount": 0, "shipping": 0, "tax": 0.00, "total": 29.95, "status": "Shipped", "paymentMethod": "Card", "shippingAddress": { "firstName": "Sara", "lastName": "Khan", "street": "456 Bandra West", "city": "Mumbai", "zip": "400050" } }
];

const DEFAULT_REVIEWS = [];

const DEFAULT_COUPONS = [
  { "code": "WELCOME10", "discountType": "percentage", "discountValue": 10, "minPurchase": 10.00, "isActive": true, "usageLimit": 100, "usedCount": 23 },
  { "code": "OM50", "discountType": "fixed", "discountValue": 5.00, "minPurchase": 20.00, "isActive": true, "usageLimit": 50, "usedCount": 12 },
  { "code": "SUPEROFFER", "discountType": "percentage", "discountValue": 25, "minPurchase": 30.00, "isActive": true, "usageLimit": 20, "usedCount": 5 }
];

const DEFAULT_BANNERS = [
  { "id": 1, "title": "New Arrivals Drop", "subtitle": "Shop our latest premium 3M mobile skins", "image": "", "link": "shop/pages/shop.html", "isActive": true, "order": 1 },
  { "id": 2, "title": "God Collection", "subtitle": "Mythological gold designs now available", "image": "", "link": "shop/pages/collections.html", "isActive": true, "order": 2 }
];

const DEFAULT_SETTINGS = {
  "storeName": "OM Mobile Art",
  "storeEmail": "ommobileart09@gmail.com",
  "storePhone": "+91 96386 52327",
  "storeAddress": "Shop No. - 1, Swadhyaya Complex, Lajamani Chowk, Mota Varachha, Surat - 394101",
  "currency": "INR",
  "currencySymbol": "₹",
  "taxRate": 0,
  "shippingFreeThreshold": 999,
  "shippingFlatRate": 99,
  "maintenanceMode": false,
  "allowReviews": true,
  "requireReviewApproval": true
};

// ─── INITIALIZE localStorage ──────────────────────────────────────────────────

function initStorageKey(key, defaultValue) {
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
  }
}

function resetToDefaults() {
  localStorage.setItem('om_products', JSON.stringify(DEFAULT_PRODUCTS));
  localStorage.setItem('om_collections', JSON.stringify(DEFAULT_COLLECTIONS));
  localStorage.setItem('om_brands', JSON.stringify(DEFAULT_BRANDS));
  localStorage.setItem('om_devices', JSON.stringify(DEFAULT_DEVICES));
  localStorage.setItem('om_users', JSON.stringify(DEFAULT_USERS));
  localStorage.setItem('om_orders', JSON.stringify(DEFAULT_ORDERS));
  localStorage.setItem('om_reviews', JSON.stringify(DEFAULT_REVIEWS));
  localStorage.setItem('om_coupons', JSON.stringify(DEFAULT_COUPONS));
  localStorage.setItem('om_banners', JSON.stringify(DEFAULT_BANNERS));
  localStorage.setItem('om_settings', JSON.stringify(DEFAULT_SETTINGS));
}

localStorage.removeItem('om_products');
initStorageKey('om_products', []);
initStorageKey('om_collections', DEFAULT_COLLECTIONS);
initStorageKey('om_brands', DEFAULT_BRANDS);
initStorageKey('om_devices', DEFAULT_DEVICES);
initStorageKey('om_users', DEFAULT_USERS);
initStorageKey('om_orders', DEFAULT_ORDERS);
initStorageKey('om_reviews', DEFAULT_REVIEWS);
initStorageKey('om_coupons', DEFAULT_COUPONS);
initStorageKey('om_banners', DEFAULT_BANNERS);
initStorageKey('om_settings', DEFAULT_SETTINGS);
initStorageKey('om_cart', []);
initStorageKey('om_wishlist', []);

// ─── DB API OBJECT ────────────────────────────────────────────────────────────

const DB = {

  // ── Products ──────────────────────────────────────────────────────────────
  getProducts: () => {
    const list = JSON.parse(localStorage.getItem('om_products')) || [];
    return list.map(p => ({
      ...p,
      requiresDeviceSelection: p.requiresDeviceSelection !== false
    }));
  },
  saveProducts: (p) => localStorage.setItem('om_products', JSON.stringify(p)),
  getProductById: (id) => DB.getProducts().find(p => String(p.id) === String(id)),
  saveProduct: (product) => {
    const products = DB.getProducts();
    const idx = products.findIndex(p => String(p.id) === String(product.id));
    if (idx !== -1) {
      products[idx] = product;
    } else {
      products.push(product);
    }
    DB.saveProducts(products);
    return product;
  },
  deleteProduct: (id) => {
    DB.saveProducts(DB.getProducts().filter(p => String(p.id) !== String(id)));
  },

  // ── Collections ───────────────────────────────────────────────────────────
  getCollections: () => JSON.parse(localStorage.getItem('om_collections')),
  saveCollections: (c) => localStorage.setItem('om_collections', JSON.stringify(c)),
  saveCollection: (col) => {
    const cols = DB.getCollections();
    const idx = cols.findIndex(c => c.id === parseInt(col.id));
    if (idx !== -1) { cols[idx] = col; } else { col.id = cols.length ? Math.max(...cols.map(c => c.id)) + 1 : 1; cols.push(col); }
    DB.saveCollections(cols);
    return col;
  },
  deleteCollection: (id) => DB.saveCollections(DB.getCollections().filter(c => c.id !== parseInt(id))),

  // ── Device Types ─────────────────────────────────────────────────────────
  getDeviceTypes: () => JSON.parse(localStorage.getItem('om_device_types')) || [
    { id: 'dt-1', name: 'Mobile', slug: 'mobile', icon: 'smartphone', status: 'Active', sortOrder: 1 },
    { id: 'dt-2', name: 'Tablet', slug: 'tablet', icon: 'tablet_mac', status: 'Active', sortOrder: 2 },
    { id: 'dt-3', name: 'Laptop', slug: 'laptop', icon: 'laptop', status: 'Active', sortOrder: 3 },
    { id: 'dt-4', name: 'Camera', slug: 'camera', icon: 'photo_camera', status: 'Active', sortOrder: 4 },
    { id: 'dt-5', name: 'Smart Watch', slug: 'watch', icon: 'watch', status: 'Active', sortOrder: 5 },
    { id: 'dt-6', name: 'AirPods', slug: 'airpods', icon: 'headphones', status: 'Active', sortOrder: 6 },
    { id: 'dt-7', name: 'Gaming Console', slug: 'console', icon: 'sports_esports', status: 'Active', sortOrder: 7 },
    { id: 'dt-8', name: 'Card Skin', slug: 'card', icon: 'credit_card', status: 'Active', sortOrder: 8 },
    { id: 'dt-9', name: 'Other', slug: 'other', icon: 'devices_other', status: 'Active', sortOrder: 9 }
  ],
  saveDeviceTypes: (dt) => localStorage.setItem('om_device_types', JSON.stringify(dt)),
  saveDeviceType: (item) => {
    const list = DB.getDeviceTypes();
    const idx = list.findIndex(d => String(d.id) === String(item.id));
    if (idx !== -1) { list[idx] = item; } else { item.id = item.id || `dt-${Date.now()}`; list.push(item); }
    DB.saveDeviceTypes(list);
    return item;
  },
  deleteDeviceType: (id) => DB.saveDeviceTypes(DB.getDeviceTypes().filter(d => String(d.id) !== String(id))),

  // ── Brands ────────────────────────────────────────────────────────────────
  getBrands: () => JSON.parse(localStorage.getItem('om_brands')) || [
    { id: 'b-1', name: 'Apple', logo: '', deviceTypes: ['Mobile', 'Tablet', 'Watch', 'AirPods'], isActive: true, sortOrder: 1 },
    { id: 'b-2', name: 'Samsung', logo: '', deviceTypes: ['Mobile', 'Tablet', 'Watch'], isActive: true, sortOrder: 2 },
    { id: 'b-3', name: 'Google', logo: '', deviceTypes: ['Mobile', 'Watch'], isActive: true, sortOrder: 3 },
    { id: 'b-4', name: 'OnePlus', logo: '', deviceTypes: ['Mobile', 'Watch', 'AirPods'], isActive: true, sortOrder: 4 },
    { id: 'b-5', name: 'Nothing', logo: '', deviceTypes: ['Mobile', 'AirPods'], isActive: true, sortOrder: 5 },
    { id: 'b-6', name: 'Dell', logo: '', deviceTypes: ['Laptop'], isActive: true, sortOrder: 6 },
    { id: 'b-7', name: 'Sony', logo: '', deviceTypes: ['Camera', 'Gaming Console'], isActive: true, sortOrder: 7 }
  ],
  saveBrands: (b) => localStorage.setItem('om_brands', JSON.stringify(b)),
  saveBrand: (item) => {
    const list = DB.getBrands();
    const idx = list.findIndex(b => String(b.id) === String(item.id));
    if (idx !== -1) { list[idx] = item; } else { item.id = item.id || `b-${Date.now()}`; list.push(item); }
    DB.saveBrands(list);
    return item;
  },
  deleteBrand: (id) => DB.saveBrands(DB.getBrands().filter(b => String(b.id) !== String(id))),

  // ── Models ────────────────────────────────────────────────────────────────
  getModels: () => JSON.parse(localStorage.getItem('om_models_list')) || [
    { id: 'm-1', brand: 'Apple', brandId: 'b-1', name: 'iPhone 16 Pro Max', isActive: true, sortOrder: 1 },
    { id: 'm-2', brand: 'Apple', brandId: 'b-1', name: 'iPhone 16 Pro', isActive: true, sortOrder: 2 },
    { id: 'm-3', brand: 'Apple', brandId: 'b-1', name: 'iPhone 16 Plus', isActive: true, sortOrder: 3 },
    { id: 'm-4', brand: 'Apple', brandId: 'b-1', name: 'iPhone 16', isActive: true, sortOrder: 4 },
    { id: 'm-5', brand: 'Samsung', brandId: 'b-2', name: 'Galaxy S25 Ultra', isActive: true, sortOrder: 5 },
    { id: 'm-6', brand: 'Samsung', brandId: 'b-2', name: 'Galaxy S25+', isActive: true, sortOrder: 6 },
    { id: 'm-7', brand: 'Samsung', brandId: 'b-2', name: 'Galaxy S25', isActive: true, sortOrder: 7 },
    { id: 'm-8', brand: 'Google', brandId: 'b-3', name: 'Pixel 9 Pro', isActive: true, sortOrder: 8 },
    { id: 'm-9', brand: 'Google', brandId: 'b-3', name: 'Pixel 9', isActive: true, sortOrder: 9 }
  ],
  saveModels: (m) => localStorage.setItem('om_models_list', JSON.stringify(m)),
  saveModel: (item) => {
    const list = DB.getModels();
    const idx = list.findIndex(m => String(m.id) === String(item.id));
    if (idx !== -1) { list[idx] = item; } else { item.id = item.id || `m-${Date.now()}`; list.push(item); }
    DB.saveModels(list);
    return item;
  },
  getBrandsByDeviceType: (deviceTypeId) => {
    const allBrands = DB.getBrands();
    const allTypes = DB.getDeviceTypes();
    const targetType = allTypes.find(t => String(t.id) === String(deviceTypeId) || t.name.toLowerCase() === String(deviceTypeId).toLowerCase());
    const typeName = targetType ? targetType.name : 'Mobile';
    const filtered = allBrands.filter(b => !b.deviceTypes || b.deviceTypes.length === 0 || b.deviceTypes.includes(typeName) || b.deviceTypes.includes(targetType ? targetType.id : ''));
    return filtered.length > 0 ? filtered : allBrands;
  },
  getModelsByBrand: (brandId, productId) => {
    const allModels = DB.getModels();
    const allBrands = DB.getBrands();
    const targetBrand = allBrands.find(b => String(b.id) === String(brandId) || b.name.toLowerCase() === String(brandId).toLowerCase());
    const brandName = targetBrand ? targetBrand.name : '';
    const filtered = allModels.filter(m => String(m.brandId) === String(brandId) || (brandName && m.brand && m.brand.toLowerCase() === brandName.toLowerCase()));
    if (filtered.length > 0) return filtered;
    const allDevices = DB.getDevices() || [];
    return allDevices
      .filter(d => !brandName || d.brand.toLowerCase() === brandName.toLowerCase())
      .map(d => ({ id: `m-${d.id}`, name: d.name, brand: d.brand }));
  },

  deleteModel: (id) => DB.saveModels(DB.getModels().filter(m => String(m.id) !== String(id))),

  // ── Devices ───────────────────────────────────────────────────────────────
  getDevices: () => JSON.parse(localStorage.getItem('om_devices')),
  saveDevices: (d) => localStorage.setItem('om_devices', JSON.stringify(d)),
  saveDevice: (device) => {
    const devices = DB.getDevices();
    const idx = devices.findIndex(d => d.id === parseInt(device.id));
    if (idx !== -1) { devices[idx] = device; } else { device.id = devices.length ? Math.max(...devices.map(d => d.id)) + 1 : 1; devices.push(device); }
    DB.saveDevices(devices);
    return device;
  },
  deleteDevice: (id) => DB.saveDevices(DB.getDevices().filter(d => d.id !== parseInt(id))),

  // ── Users ─────────────────────────────────────────────────────────────────
  getUsers: () => JSON.parse(localStorage.getItem('om_users')),
  saveUsers: (u) => localStorage.setItem('om_users', JSON.stringify(u)),
  registerUser: (user) => {
    return { success: false, message: 'Direct registration disabled. Mandatory email OTP verification required.' };
  },
  authenticateUser: (email, password) => {
    const user = DB.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (user) {
      localStorage.setItem('om_user_session', JSON.stringify(user));
      return { success: true, user };
    }
    return { success: false, message: 'Invalid email or password.' };
  },
  getCurrentUser: () => {
    const isAdminPage = window.location.pathname.includes('/admin/');
    if (isAdminPage) {
      const adminSession = JSON.parse(localStorage.getItem('om_admin_session') || 'null');
      if (adminSession) {
        adminSession.isAdmin = true;
        adminSession.role = adminSession.role || 'ADMIN';
      }
      return adminSession;
    }
    const customerSession = JSON.parse(localStorage.getItem('om_customer_session') || localStorage.getItem('om_user_session') || 'null');
    if (customerSession && (customerSession.role === 'ADMIN' || customerSession.isAdmin)) {
      console.warn('[Auth Audit] Found admin role in customer session key on storefront page. Discarding invalid customer context.');
      return null;
    }
    if (customerSession) {
      if (!customerSession.name || customerSession.name === 'null' || customerSession.name.trim() === '') {
        customerSession.name = customerSession.email ? customerSession.email.split('@')[0] : 'Customer';
      }
    }
    return customerSession;
  },
  logoutUser: () => {
    const isAdminPage = window.location.pathname.includes('/admin/');
    if (isAdminPage) {
      localStorage.removeItem('om_admin_session');
      localStorage.removeItem('om_admin_auth_token');
    } else {
      localStorage.removeItem('om_user_session');
      localStorage.removeItem('om_customer_session');
      localStorage.removeItem('om_auth_token');
      localStorage.removeItem('om_customer_auth_token');
    }
  },
  updateCurrentUser: (fields) => {
    const current = DB.getCurrentUser();
    if (!current) return null;
    const users = DB.getUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === current.email.toLowerCase());
    if (idx !== -1) {
      const updated = { ...users[idx], ...fields };
      users[idx] = updated;
      DB.saveUsers(users);
      const isAdminPage = window.location.pathname.includes('/admin/');
      if (isAdminPage) {
        localStorage.setItem('om_admin_session', JSON.stringify(updated));
      } else {
        localStorage.setItem('om_customer_session', JSON.stringify(updated));
        localStorage.setItem('om_user_session', JSON.stringify(updated));
      }
      return updated;
    }
    return null;
  },
  updateUser: (email, fields) => {
    const users = DB.getUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx !== -1) { users[idx] = { ...users[idx], ...fields }; DB.saveUsers(users); return users[idx]; }
    return null;
  },
  deleteUser: (email) => DB.saveUsers(DB.getUsers().filter(u => u.email.toLowerCase() !== email.toLowerCase())),

  // ── Cart ──────────────────────────────────────────────────────────────────
  getCart: () => {
    let c = JSON.parse(localStorage.getItem('om_cart')) || [];
    let updated = false;
    c.forEach(item => {
      const minQty = item.minOrderQuantity || item.minOrderQty || 1;
      if (item.qty < minQty) {
        item.qty = minQty;
        if (item.quantity) item.quantity = minQty;
        updated = true;
      }
    });
    if (updated) {
      localStorage.setItem('om_cart', JSON.stringify(c));
    }
    return c;
  },
  saveCart: (cart) => {
    localStorage.setItem('om_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
  },
  addToCart: (item) => {
    const cart = DB.getCart();
    const minQty = item.minOrderQuantity || item.minOrderQty || 1;
    const itemQty = Math.max(minQty, item.qty || item.quantity || 1);
    item.qty = itemQty;
    if (item.quantity) item.quantity = itemQty;

    const matchIdx = cart.findIndex(c => c.id === item.id && c.device === item.device && c.finish === item.finish && c.material === item.material && c.deviceModel === item.deviceModel && c.customModelName === item.customModelName && (c.deviceTypeId === item.deviceTypeId || c.deviceType === item.deviceType));
    if (matchIdx !== -1) { 
      cart[matchIdx].qty += itemQty; 
      if (cart[matchIdx].quantity) cart[matchIdx].quantity = cart[matchIdx].qty;
    } else { 
      cart.push(item); 
    }
    DB.saveCart(cart);
  },
  removeFromCart: (index) => { const c = DB.getCart(); c.splice(index, 1); DB.saveCart(c); },
  updateCartQty: (index, qty) => { 
    const c = DB.getCart(); 
    if (c[index]) { 
      const minQty = c[index].minOrderQuantity || c[index].minOrderQty || 1;
      const finalQty = Math.max(minQty, parseInt(qty));
      c[index].qty = finalQty; 
      if (c[index].quantity) c[index].quantity = finalQty;
      DB.saveCart(c); 
    } 
  },
  clearCart: () => DB.saveCart([]),

  // ── Wishlist ──────────────────────────────────────────────────────────────
  getWishlist: () => {
    try {
      const raw = localStorage.getItem('om_wishlist');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // Filter out empty or legacy mock IDs ("1", "2", "3") that don't match database UUIDs
      return arr.map(id => String(id).trim()).filter(id => id !== '' && id !== '1' && id !== '2' && id !== '3' && id !== 'undefined' && id !== 'null');
    } catch (e) {
      return [];
    }
  },
  saveWishlist: (w) => {
    const cleaned = Array.isArray(w) ? w.map(id => String(id)) : [];
    localStorage.setItem('om_wishlist', JSON.stringify(cleaned));
    window.dispatchEvent(new Event('wishlist-updated'));
    window.dispatchEvent(new Event('wishlistUpdated'));
  },
  toggleWishlist: (productId) => {
    if (productId === undefined || productId === null) return false;
    const targetId = String(productId).trim();
    const wishlist = DB.getWishlist();
    const idx = wishlist.findIndex(id => String(id).trim() === targetId);
    let added = false;
    if (idx !== -1) {
      wishlist.splice(idx, 1);
      added = false;
    } else {
      wishlist.push(targetId);
      added = true;
    }
    DB.saveWishlist(wishlist);
    return added;
  },
  isInWishlist: (productId) => {
    if (productId === undefined || productId === null) return false;
    const targetId = String(productId).trim();
    const wishlist = DB.getWishlist();
    return wishlist.some(id => String(id).trim() === targetId);
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  getOrders: () => JSON.parse(localStorage.getItem('om_orders')) || [
    {
      id: 'OM-1001',
      orderNumber: 'OM-1001',
      customerName: 'John Doe',
      customerEmail: 'john@gmail.com',
      userEmail: 'john@gmail.com',
      shippingAddress: { firstName: 'John', lastName: 'Doe', email: 'john@gmail.com', address: '123 Tech Park, Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
      orderDate: new Date(Date.now() - 86400000 * 2).toISOString(),
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      items: [{ id: 1, name: 'Cybernetic Cyberpunk Skin', qty: 1, price: 499 }],
      itemsCount: 1,
      total: 499,
      status: 'Placed',
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'UNFULFILLED'
    },
    {
      id: 'OM-1002',
      orderNumber: 'OM-1002',
      customerName: 'Sarah Connor',
      customerEmail: 'sarah@gmail.com',
      userEmail: 'sarah@gmail.com',
      shippingAddress: { firstName: 'Sarah', lastName: 'Connor', email: 'sarah@gmail.com', address: '456 Cyber Road, HSR Layout', city: 'Bengaluru', state: 'Karnataka', pincode: '560102' },
      orderDate: new Date(Date.now() - 86400000 * 1).toISOString(),
      date: new Date(Date.now() - 86400000 * 1).toISOString(),
      items: [{ id: 2, name: 'Matte Stealth Black Skin', qty: 2, price: 399 }],
      itemsCount: 2,
      total: 798,
      status: 'Processing',
      paymentMethod: 'Card',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'PROCESSING'
    },
    {
      id: 'OM-1003',
      orderNumber: 'OM-1003',
      customerName: 'Alex Mercer',
      customerEmail: 'alex@gmail.com',
      userEmail: 'alex@gmail.com',
      shippingAddress: { firstName: 'Alex', lastName: 'Mercer', email: 'alex@gmail.com', address: '789 Silicon Hub, Bandra', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
      orderDate: new Date().toISOString(),
      date: new Date().toISOString(),
      items: [{ id: 3, name: 'Leather Texture Wrap', qty: 1, price: 599 }],
      itemsCount: 1,
      total: 599,
      status: 'Shipped',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'SHIPPED'
    }
  ],
  saveOrders: (o) => localStorage.setItem('om_orders', JSON.stringify(o)),
  placeOrder: (order) => {
    const orders = DB.getOrders();
    order.id = `OM-${1000 + orders.length + 1}`;
    order.orderNumber = order.id;
    order.orderDate = new Date().toISOString();
    order.date = new Date().toISOString();
    order.status = 'Placed';
    orders.push(order);
    DB.saveOrders(orders);
    const products = DB.getProducts();
    order.items.forEach(item => {
      const prod = products.find(p => p.id === parseInt(item.id));
      if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
    });
    DB.saveProducts(products);
    return order;
  },
  updateOrderStatus: (orderId, status) => {
    const orders = DB.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) { orders[idx].status = status; DB.saveOrders(orders); return true; }
    return false;
  },
  deleteOrder: (orderId) => DB.saveOrders(DB.getOrders().filter(o => o.id !== orderId)),

  // ── Coupons ───────────────────────────────────────────────────────────────
  getCoupons: () => JSON.parse(localStorage.getItem('om_coupons')) || [
    { id: '1', code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minOrderAmount: 499, isActive: true, usageCount: 25 },
    { id: '2', code: 'FESTIVE20', discountType: 'percentage', discountValue: 20, minOrderAmount: 999, isActive: true, usageCount: 14 },
    { id: '3', code: 'FLAT100', discountType: 'fixed', discountValue: 100, minOrderAmount: 799, isActive: true, usageCount: 8 }
  ],
  saveCoupons: (c) => localStorage.setItem('om_coupons', JSON.stringify(c)),
  validateCoupon: (code) => DB.getCoupons().find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive !== false),
  saveCoupon: (coupon) => {
    const coupons = DB.getCoupons();
    const idx = coupons.findIndex(c => c.code.toUpperCase() === coupon.code.toUpperCase());
    if (idx !== -1) { coupons[idx] = coupon; } else { coupons.push(coupon); }
    DB.saveCoupons(coupons);
    return coupon;
  },
  deleteCoupon: (code) => DB.saveCoupons(DB.getCoupons().filter(c => c.code.toUpperCase() !== code.toUpperCase())),

  // ── Reviews ───────────────────────────────────────────────────────────────
  getReviews: () => JSON.parse(localStorage.getItem('om_reviews')),
  saveReviews: (r) => localStorage.setItem('om_reviews', JSON.stringify(r)),
  getReviewsForProduct: (productId) => DB.getReviews().filter(r => r.productId === parseInt(productId) && r.approved !== false),
  addReview: (review) => {
    const reviews = DB.getReviews();
    review.id = reviews.length + 1;
    review.date = new Date().toISOString().split('T')[0];
    review.approved = false; // requires admin approval
    reviews.push(review);
    DB.saveReviews(reviews);
    return review;
  },
  approveReview: (id) => {
    const reviews = DB.getReviews();
    const idx = reviews.findIndex(r => r.id === parseInt(id));
    if (idx !== -1) { reviews[idx].approved = true; DB.saveReviews(reviews); return true; }
    return false;
  },
  deleteReview: (id) => DB.saveReviews(DB.getReviews().filter(r => r.id !== parseInt(id))),

  // ── Banners ───────────────────────────────────────────────────────────────
  getBanners: () => JSON.parse(localStorage.getItem('om_banners')),
  saveBanners: (b) => localStorage.setItem('om_banners', JSON.stringify(b)),
  saveBanner: (banner) => {
    const banners = DB.getBanners();
    const idx = banners.findIndex(b => b.id === parseInt(banner.id));
    if (idx !== -1) { banners[idx] = banner; } else { banner.id = banners.length ? Math.max(...banners.map(b => b.id)) + 1 : 1; banners.push(banner); }
    DB.saveBanners(banners);
    return banner;
  },
  deleteBanner: (id) => DB.saveBanners(DB.getBanners().filter(b => b.id !== parseInt(id))),

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: () => JSON.parse(localStorage.getItem('om_settings')),
  saveSettings: (s) => localStorage.setItem('om_settings', JSON.stringify({ ...DB.getSettings(), ...s })),

  // ── Recently Viewed ───────────────────────────────────────────────────────
  getRecentlyViewed: () => JSON.parse(localStorage.getItem('om_recently_viewed') || '[]'),
  addRecentlyViewed: (productId) => {
    let recent = DB.getRecentlyViewed();
    recent = recent.filter(id => id !== parseInt(productId));
    recent.unshift(parseInt(productId));
    if (recent.length > 8) recent = recent.slice(0, 8);
    localStorage.setItem('om_recently_viewed', JSON.stringify(recent));
  },

  // ── Utility ───────────────────────────────────────────────────────────────
  resetToDefaults
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────
window.DB = DB;

async function getAuthToken(forceRefresh = false) {
  const isAdminPage = window.location.pathname.includes('/admin/');
  const tokenKey = isAdminPage ? 'om_admin_auth_token' : 'om_auth_token';

  let token = localStorage.getItem(tokenKey);
  if (!isAdminPage && !token) {
    token = localStorage.getItem('om_customer_auth_token');
  }

  if (token) return token;
  return null;
}

window.API = {
  getAuthToken,
  getProducts: ()                  => Promise.resolve(window.DB.getProducts()),
  getProductById: (id)             => Promise.resolve(window.DB.getProductById(id)),
  saveProduct: (product)           => Promise.resolve(window.DB.saveProduct(product)),
  deleteProduct: (id)              => { window.DB.deleteProduct(id); return Promise.resolve(true); },
  getCollections: ()               => Promise.resolve(window.DB.getCollections()),
  saveCollection: (col)            => Promise.resolve(window.DB.saveCollection(col)),
  deleteCollection: (id)           => { window.DB.deleteCollection(id); return Promise.resolve(true); },
  getBrands: ()                    => Promise.resolve(window.DB.getBrands()),
  getDevices: ()                   => Promise.resolve(window.DB.getDevices()),
  saveDevice: (device)             => Promise.resolve(window.DB.saveDevice(device)),
  deleteDevice: (id)               => { window.DB.deleteDevice(id); return Promise.resolve(true); },
  getUsers: ()                     => Promise.resolve(window.DB.getUsers()),
  registerUser: (user)             => Promise.resolve(window.DB.registerUser(user)),
  login: (email, password)         => Promise.resolve(window.DB.authenticateUser(email, password)),
  getCurrentUser: ()               => Promise.resolve(window.DB.getCurrentUser()),
  logout: ()                       => { window.DB.logoutUser(); return Promise.resolve(true); },
  updateCurrentUser: (fields)      => Promise.resolve(window.DB.updateCurrentUser(fields)),
  updateUser: (email, fields)      => Promise.resolve(window.DB.updateUser(email, fields)),
  deleteUser: (email)              => { window.DB.deleteUser(email); return Promise.resolve(true); },
  getCart: ()                      => Promise.resolve(window.DB.getCart()),
  addToCart: async (item)          => {
    console.log('API.addToCart called with item:', item);
    try {
      const productUuid = `10000000-0000-0000-0000-${String(item.id).padStart(12, '0')}`;
      
      const productRes = await fetch(`http://localhost:3000/api/v1/products/${productUuid}`);
      if (!productRes.ok) {
        throw new Error(`Failed to fetch product from backend: ${productRes.statusText}`);
      }
      const productData = await productRes.json();
      const variants = productData.data.variants || [];
      
      const finish = item.finish || 'Matte';
      const material = item.material || 'Standard 3M';
      
      const variant = variants.find(v => 
        v.finish.toLowerCase() === finish.toLowerCase() && 
        v.material.toLowerCase() === material.toLowerCase()
      ) || variants[0];

      if (!variant) {
        throw new Error('No variants found for this product');
      }

      let token = await getAuthToken();
      if (!token) {
        throw new Error('User is not authenticated');
      }

      let cartRes = await fetch('http://localhost:3000/api/v1/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: productUuid,
          productVariantId: variant.id,
          quantity: item.qty || 1,
          modelId: item.modelId
        })
      });

      if (!cartRes.ok && cartRes.status === 401) {
        console.warn('Authentication token expired or invalid, retrying...');
        localStorage.removeItem('om_auth_token');
        token = await getAuthToken();
        if (token) {
          cartRes = await fetch('http://localhost:3000/api/v1/cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              productId: productUuid,
              productVariantId: variant.id,
              quantity: item.qty || 1,
              modelId: item.modelId
            })
          });
        }
      }

      if (!cartRes.ok) {
        const errData = await cartRes.json().catch(() => ({}));
        const errMsg = errData.error?.message || errData.message || `HTTP ${cartRes.status}`;
        throw new Error(errMsg);
      }

      window.DB.addToCart(item);
      window.dispatchEvent(new Event('cart-updated'));
      return true;
    } catch (error) {
      console.error('API.addToCart failed:', error);
      throw error;
    }
  },
  removeFromCart: (index)          => { window.DB.removeFromCart(index); return Promise.resolve(true); },
  updateCartQty: (index, qty)      => { window.DB.updateCartQty(index, qty); return Promise.resolve(true); },
  clearCart: ()                    => { window.DB.clearCart(); return Promise.resolve(true); },
  getWishlist: ()                  => Promise.resolve(window.DB.getWishlist()),
  toggleWishlist: (productId)      => Promise.resolve(window.DB.toggleWishlist(productId)),
  isInWishlist: (productId)        => Promise.resolve(window.DB.isInWishlist(productId)),
  getOrders: ()                    => Promise.resolve(window.DB.getOrders()),
  placeOrder: (order)              => Promise.resolve(window.DB.placeOrder(order)),
  updateOrderStatus: (id, status)  => Promise.resolve(window.DB.updateOrderStatus(id, status)),
  deleteOrder: (id)                => { window.DB.deleteOrder(id); return Promise.resolve(true); },
  getCoupons: ()                   => Promise.resolve(window.DB.getCoupons()),
  validateCoupon: (code)           => Promise.resolve(window.DB.validateCoupon(code)),
  saveCoupon: (coupon)             => Promise.resolve(window.DB.saveCoupon(coupon)),
  deleteCoupon: (code)             => { window.DB.deleteCoupon(code); return Promise.resolve(true); },
  getReviews: ()                   => Promise.resolve(window.DB.getReviews()),
  getReviewsForProduct: (id)       => Promise.resolve(window.DB.getReviewsForProduct(id)),
  addReview: (review)              => Promise.resolve(window.DB.addReview(review)),
  approveReview: (id)              => Promise.resolve(window.DB.approveReview(id)),
  deleteReview: (id)               => { window.DB.deleteReview(id); return Promise.resolve(true); },
  getBanners: ()                   => Promise.resolve(window.DB.getBanners()),
  saveBanner: (banner)             => Promise.resolve(window.DB.saveBanner(banner)),
  deleteBanner: (id)               => { window.DB.deleteBanner(id); return Promise.resolve(true); },
  getSettings: ()                  => Promise.resolve(window.DB.getSettings()),
  saveSettings: (s)                => { window.DB.saveSettings(s); return Promise.resolve(true); },
  getRecentlyViewed: ()            => Promise.resolve(window.DB.getRecentlyViewed()),
  addRecentlyViewed: (id)          => { window.DB.addRecentlyViewed(id); return Promise.resolve(true); },
};


