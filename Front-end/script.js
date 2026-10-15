'use strict';

const API_URL = 'http://127.0.0.1:8000/api';

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

const tabs = [...document.querySelectorAll('.tab')];
const cards = [...document.querySelectorAll('.product-card')];
const productGrid = document.querySelector('.product-grid');

const heroImage = document.querySelector('.hero-product img');
const heroTitle = document.querySelector('.hero h1');
const heroFlavor = document.querySelector('.hero-flavor');
const dots = [...document.querySelectorAll('.dot')];

const cartDialog = document.querySelector('.cart-dialog');
const cartOpen = document.querySelector('.cart-open');
const cartItemsElement = document.querySelector('.cart-items');
const cartCount = document.querySelector('.cart-count');
const cartEmpty = document.querySelector('.cart-empty');
const cartTotal = document.querySelector('.cart-total');
const checkoutButton = document.querySelector('.checkout-button');
const cartView = document.querySelector('.cart-view');
const checkoutView = document.querySelector('.checkout-view');
const checkoutForm = document.querySelector('.checkout-form');
const formMessage = document.querySelector('.form-message');

/* ---------- Utilidades ---------- */
function formatMoney(amount) {
  const number = amount.toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `RD$ ${number}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

menuToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
});

mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

function selectCategory(category) {
  tabs.forEach((tab) => {
    const selected = tab.dataset.filter === category;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });

  cards.forEach((card) => {
    card.hidden = card.dataset.category !== category;
  });
}

function moveCategory(direction) {
  const current = tabs.findIndex((tab) => tab.classList.contains('active'));
  const next = (current + direction + tabs.length) % tabs.length;
  selectCategory(tabs[next].dataset.filter);
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => selectCategory(tab.dataset.filter));
});

document.querySelector('.rail-left').addEventListener('click', () => moveCategory(-1));
document.querySelector('.rail-right').addEventListener('click', () => moveCategory(1));

const slides = [
  { image: 'images/slider1.png', title: 'HAMBURGUESA', caption: 'La favorita de la casa' },
  { image: 'images/slider2.png', title: 'BURGER BBQ',  caption: 'Sabor que prende' },
  { image: 'images/slider3.png', title: 'MÁS SABOR',   caption: 'Un antojo diferente' },
];
let activeSlide = 0;

function showSlide(index) {
  activeSlide = (index + slides.length) % slides.length;
  const slide = slides[activeSlide];

  heroImage.src = slide.image;
  heroTitle.textContent = slide.title;
  heroFlavor.textContent = slide.caption;
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex === activeSlide);
  });
}

document.querySelector('.hero-arrow.previous').addEventListener('click', () => showSlide(activeSlide - 1));
document.querySelector('.hero-arrow.next').addEventListener('click', () => showSlide(activeSlide + 1));
dots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));

const cart = new Map();

function updateCart() {
  const items = [...cart.values()];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  cartCount.textContent = itemCount;
  cartCount.hidden = itemCount === 0;
  cartEmpty.hidden = items.length > 0;
  checkoutButton.disabled = items.length === 0;
  cartTotal.textContent = formatMoney(total);

  cartItemsElement.innerHTML = items.map((item) => `
    <div class="cart-row" data-item="${escapeHtml(item.name)}">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${formatMoney(item.price)}</small>
      </div>
      <div class="quantity-control">
        <button type="button" data-action="minus" aria-label="Quitar uno de ${escapeHtml(item.name)}">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-action="plus" aria-label="Agregar uno de ${escapeHtml(item.name)}">+</button>
      </div>
    </div>`).join('');
}

productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('.add-to-cart');
  if (!button) return;

  const card = button.closest('.product-card');
  const name = card.dataset.name;
  const item = cart.get(name) || { name, price: Number(card.dataset.price), quantity: 0 };
  item.quantity += 1;
  cart.set(name, item);
  updateCart();

  
  button.dataset.label = button.dataset.label || button.textContent;
  button.textContent = 'Agregado ✓';
  window.clearTimeout(button.resetTimer);
  button.resetTimer = window.setTimeout(() => {
    button.textContent = button.dataset.label;
  }, 1000);
});

cartItemsElement.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const row = button.closest('.cart-row');
  const item = cart.get(row.dataset.item);
  if (!item) return;

  item.quantity += button.dataset.action === 'plus' ? 1 : -1;
  if (item.quantity <= 0) cart.delete(item.name);
  updateCart();
});

cartOpen.addEventListener('click', () => {
  cartView.hidden = false;
  checkoutView.hidden = true;
  cartDialog.showModal();
});

document.querySelector('.cart-close').addEventListener('click', () => cartDialog.close());

cartDialog.addEventListener('click', (event) => {
  if (event.target === cartDialog) cartDialog.close();
});

checkoutButton.addEventListener('click', () => {
  cartView.hidden = true;
  checkoutView.hidden = false;
  formMessage.textContent = '';
});

document.querySelector('.back-to-cart').addEventListener('click', () => {
  checkoutView.hidden = true;
  cartView.hidden = false;
});

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = checkoutForm.querySelector('.submit-order');
  const formData = new FormData(checkoutForm);
  const items = [...cart.values()].map(({ name, price, quantity }) => ({ name, price, quantity }));

  const order = {
    customer: {
      name: formData.get('name').trim(),
      phone: formData.get('phone').trim(),
      address: formData.get('address').trim(),
      notes: formData.get('notes').trim(),
    },
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    currency: 'DOP',
  };

  submitButton.disabled = true;
  submitButton.textContent = 'Enviando…';
  formMessage.textContent = '';
  formMessage.classList.remove('success');

  try {
    const response = await fetch(`${API_URL}/pedidos/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const saved = await response.json();
    formMessage.textContent = `¡Pedido #${saved.id} enviado! La tienda se pondrá en contacto contigo.`;
    formMessage.classList.add('success');
    cart.clear();
    updateCart();
    checkoutForm.reset();
    window.setTimeout(() => cartDialog.close(), 2200);
  } catch (error) {
    console.error('No se pudo enviar el pedido:', error);
    formMessage.textContent = 'No se pudo enviar el pedido. Verifica que el servidor esté encendido e inténtalo de nuevo.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar pedido';
  }
});

updateCart();