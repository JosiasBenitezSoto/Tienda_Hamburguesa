'use strict';

const API_URL = 'http://127.0.0.1:8000/api';

const REFRESCO_PEDIDOS = 5000;   
const REFRESCO_RESUMEN = 30000;  
const MINUTOS_DEMORA = 15;      

const VISTAS_POR_ROL = {
  Administrador: ['resumen', 'cocina', 'caja'],
  Chef: ['cocina'],
  Cajero: ['caja'],
};

const NOMBRE_ESTADO = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const PRODUCTOS = [
  { name: 'La Clásica', price: 295 },
  { name: 'Fuego Bacon', price: 395 },
  { name: 'Chicken Crunch', price: 345 },
  { name: 'Burrito Clásico', price: 280 },
  { name: 'Burrito Pollo', price: 295 },
  { name: 'Burrito Mar y Tierra', price: 360 },
  { name: 'Ensalada Crunch', price: 250 },
  { name: 'Brochetas BBQ', price: 275 },
  { name: 'Pizza Pepperoni', price: 320 },
];

const $ = (selector) => document.querySelector(selector);

const loginScreen = $('#login-screen');
const loginForm = $('#login-form');
const loginMessage = $('#login-message');
const app = $('#app');
const banner = $('#banner');
const liveStatus = $('#live-status');
const liveText = $('#live-text');


let sesion = null;      
let vistaActual = null;
let temporizador = null;
let cargando = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount) {
  const number = Number(amount || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `RD$ ${number}`;
}

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
}

function minutosDesde(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function textoTiempo(iso) {
  const min = minutosDesde(iso);
  if (min < 1) return 'Recién llegado';
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  return `Hace ${horas} h ${min % 60} min`;
}

function badge(estado) {
  return `<span class="badge ${escapeHtml(estado)}">${escapeHtml(NOMBRE_ESTADO[estado] || estado)}</span>`;
}

function resumenProductos(pedido) {
  return pedido.detalles.map((d) => `${d.cantidad}× ${d.producto}`).join(', ');
}

// localStorage puede fallar (modo privado, permisos): nunca debe romper la página
const almacen = {
  leer(clave) {
    try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
  },
  guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
  },
  borrar(clave) {
    try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ }
  },
};

function mostrarBanner(texto) {
  banner.textContent = texto;
  banner.hidden = !texto;
}

function marcarConexion(ok) {
  liveStatus.classList.toggle('offline', !ok);
  liveText.textContent = ok ? 'En vivo' : 'Sin conexión';
}

class SesionVencida extends Error {}

// Todas las peticiones pasan por aquí: así el token va siempre incluido
async function api(ruta, opciones = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (sesion?.token) headers.Authorization = `Token ${sesion.token}`;

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, { ...opciones, headers });
  } catch {
    marcarConexion(false);
    throw new Error('No hay conexión con el servidor. Verifica que el backend esté encendido.');
  }
  marcarConexion(true);

  if (respuesta.status === 401) throw new SesionVencida();

  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(datos?.detail || `El servidor respondió con un error (${respuesta.status}).`);
  }
  return datos;
}

function manejarError(error) {
  if (error instanceof SesionVencida) {
    cerrarSesion('Tu sesión venció. Vuelve a iniciar sesión.');
    return;
  }
  mostrarBanner(error.message);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const datos = new FormData(loginForm);
  const username = datos.get('username').trim();
  const password = datos.get('password');
  const boton = loginForm.querySelector('button[type="submit"]');

  if (!username || !password) {
    loginMessage.textContent = 'Escribe tu usuario y tu contraseña.';
    return;
  }

  boton.disabled = true;
  boton.textContent = 'Entrando…';
  loginMessage.textContent = '';

  try {
    const respuesta = await api('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    sesion = { token: respuesta.token, rol: respuesta.rol, nombre: respuesta.nombre };
    almacen.guardar('foodDriveSesion', sesion);
    loginForm.reset();
    abrirPanel();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Entrar';
  }
});

$('#logout-button').addEventListener('click', async () => {
  try { await api('/auth/logout/', { method: 'POST' }); } catch { /* igual salimos */ }
  cerrarSesion();
});

function cerrarSesion(mensaje = '') {
  detenerRefresco();
  sesion = null;
  vistaActual = null;
  almacen.borrar('foodDriveSesion');
  app.hidden = true;
  loginScreen.hidden = false;
  mostrarBanner('');
  loginMessage.textContent = mensaje;
  loginForm.querySelector('input[name="username"]').focus();
}

function abrirPanel() {
  loginScreen.hidden = true;
  app.hidden = false;
  $('#user-name').textContent = sesion.nombre;
  $('#user-role').textContent = sesion.rol;

  const permitidas = VISTAS_POR_ROL[sesion.rol] || [];
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.hidden = !permitidas.includes(tab.dataset.view);
  });
  // Con una sola sección no hace falta mostrar las pestañas
  $('#app-nav').hidden = permitidas.length < 2;

  mostrarVista(permitidas[0]);
}

document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => mostrarVista(tab.dataset.view));
});

function mostrarVista(vista) {
  if (!vista) return;
  vistaActual = vista;
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${vista}`; });
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === vista);
  });
  mostrarBanner('');
  iniciarRefresco();
}

function detenerRefresco() {
  clearInterval(temporizador);
  temporizador = null;
}

function iniciarRefresco() {
  detenerRefresco();
  cargarVista();
  const cada = vistaActual === 'resumen' ? REFRESCO_RESUMEN : REFRESCO_PEDIDOS;
  temporizador = setInterval(() => {
    if (!document.hidden) cargarVista();
  }, cada);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && sesion && vistaActual) cargarVista();
});

async function cargarVista() {
  if (cargando || !sesion) return;
  cargando = true;
  try {
    if (vistaActual === 'cocina') await cargarCocina();
    if (vistaActual === 'caja') await cargarCaja();
    if (vistaActual === 'resumen') await cargarResumen();
    mostrarBanner('');
  } catch (error) {
    manejarError(error);
  } finally {
    cargando = false;
  }
}

async function cambiarEstado(id, estado) {
  try {
    await api(`/pedidos/${id}/estado/`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
    await cargarVista();
  } catch (error) {
    manejarError(error);
  }
}

document.addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-accion]');
  if (!boton) return;

  const { id, accion } = boton.dataset;
  if (accion === 'cancelado' && !window.confirm(`¿Cancelar el pedido #${id}?`)) return;

  boton.disabled = true;
  cambiarEstado(id, accion);
});

function ticketHtml(pedido, { mostrarCliente = false, acciones = '' } = {}) {
  const enCurso = pedido.estado === 'pendiente' || pedido.estado === 'en_preparacion';
  const tarde = enCurso && minutosDesde(pedido.creado_en) >= MINUTOS_DEMORA;

  const items = pedido.detalles
    .map((d) => `<li><b>${d.cantidad}×</b>${escapeHtml(d.producto)}</li>`)
    .join('');

  const esMostrador = pedido.cliente_telefono === 'Mostrador';
  const contacto = esMostrador
    ? 'Pedido en mostrador'
    : `${pedido.cliente_telefono} · ${pedido.direccion_entrega}`;

  const cliente = mostrarCliente
    ? `<div class="ticket-client">${escapeHtml(pedido.cliente_nombre)}
         <small>${escapeHtml(contacto)}</small></div>`
    : `<div class="ticket-client">${escapeHtml(pedido.cliente_nombre)}</div>`;

  const notas = pedido.notas
    ? `<p class="ticket-notes">Nota: ${escapeHtml(pedido.notas)}</p>`
    : '';

  return `
    <article class="ticket${tarde ? ' late' : ''}" data-estado="${escapeHtml(pedido.estado)}">
      <div class="ticket-head">
        <span class="ticket-id">#${pedido.id}</span>
        <span class="ticket-time" title="${escapeHtml(formatHora(pedido.creado_en))}">${textoTiempo(pedido.creado_en)}</span>
      </div>
      ${cliente}
      <ul class="ticket-items">${items}</ul>
      ${notas}
      <div class="ticket-foot">${acciones}</div>
    </article>`;
}

function boton(id, accion, texto, clase = 'red-button') {
  return `<button class="${clase}" type="button" data-id="${id}" data-accion="${accion}">${texto}</button>`;
}

function pintarLista(contenedor, pedidos, crearHtml, textoVacio) {
  contenedor.innerHTML = pedidos.length
    ? pedidos.map(crearHtml).join('')
    : `<p class="empty">${textoVacio}</p>`;
}

async function cargarCocina() {
  const pedidos = await api('/pedidos/?estado=pendiente,en_preparacion,listo&orden=antiguos');

  const columnas = {
    pendiente: { textoVacio: 'No hay pedidos nuevos.' },
    en_preparacion: { textoVacio: 'Nada en preparación.' },
    listo: { textoVacio: 'Nada esperando entrega.' },
  };

  Object.entries(columnas).forEach(([estado, { textoVacio }]) => {
    const deEstaColumna = pedidos.filter((p) => p.estado === estado);
    $(`#count-${estado}`).textContent = deEstaColumna.length;

    pintarLista($(`#col-${estado}`), deEstaColumna, (p) => {
      let acciones = '';
      if (estado === 'pendiente') acciones = boton(p.id, 'en_preparacion', 'Empezar');
      if (estado === 'en_preparacion') acciones = boton(p.id, 'listo', 'Marcar listo');
      if (estado === 'listo') acciones = '<span class="ticket-wait">Esperando al cajero</span>';
      return ticketHtml(p, { acciones: `<div class="ticket-actions">${acciones}</div>` });
    }, textoVacio);
  });
}

async function cargarCaja() {
  const [activos, deHoy] = await Promise.all([
    api('/pedidos/?estado=pendiente,en_preparacion,listo&orden=antiguos'),
    api('/pedidos/?desde=hoy'),
  ]);

  const listos = activos.filter((p) => p.estado === 'listo');
  const enCurso = activos.filter((p) => p.estado !== 'listo');

  $('#count-entregar').textContent = listos.length;
  $('#count-curso').textContent = enCurso.length;

  pintarLista($('#caja-listos'), listos, (p) => ticketHtml(p, {
    mostrarCliente: true,
    acciones: `<span class="ticket-total">${formatMoney(p.total)}</span>
               <div class="ticket-actions">${boton(p.id, 'entregado', 'Entregar')}</div>`,
  }), 'Ningún pedido listo por ahora.');

  pintarLista($('#caja-curso'), enCurso, (p) => ticketHtml(p, {
    mostrarCliente: true,
    acciones: `${badge(p.estado)}
               <div class="ticket-actions">${boton(p.id, 'cancelado', 'Cancelar', 'ghost-button')}</div>`,
  }), 'No hay pedidos en cocina.');

  $('#caja-historial').innerHTML = deHoy.length
    ? deHoy.map((p) => `
        <tr>
          <td>#${p.id}</td>
          <td>${escapeHtml(formatHora(p.creado_en))}</td>
          <td>${escapeHtml(p.cliente_nombre)}</td>
          <td>${escapeHtml(p.cliente_telefono)}</td>
          <td class="num">${formatMoney(p.total)}</td>
          <td>${badge(p.estado)}</td>
        </tr>`).join('')
    : '<tr><td colspan="6"><p class="empty">Todavía no hay pedidos hoy.</p></td></tr>';
}

const orderDialog = $('#order-dialog');
const orderForm = $('#order-form');
const orderMessage = $('#order-message');
const orderSubmit = $('#order-submit');
const pos = new Map();  

$('#pos-products').innerHTML = PRODUCTOS.map((p, i) => `
  <button class="pos-product" type="button" data-producto="${i}">
    <strong>${escapeHtml(p.name)}</strong><span>${formatMoney(p.price)}</span>
  </button>`).join('');

function pintarPos() {
  const items = [...pos.values()];
  const total = items.reduce((suma, i) => suma + i.price * i.quantity, 0);
  $('#pos-total').textContent = formatMoney(total);
  orderSubmit.disabled = items.length === 0;

  $('#pos-lines').innerHTML = items.length
    ? items.map((i) => `
        <div class="pos-line" data-nombre="${escapeHtml(i.name)}">
          <span>${escapeHtml(i.name)}</span>
          <span class="pos-qty">
            <button type="button" data-pos="-1" aria-label="Quitar uno">−</button>
            <b>${i.quantity}</b>
            <button type="button" data-pos="1" aria-label="Agregar uno">+</button>
          </span>
        </div>`).join('')
    : '<p class="muted">Toca un producto para agregarlo.</p>';
}

$('#new-order-button').addEventListener('click', () => {
  pos.clear();
  orderForm.reset();
  orderMessage.textContent = '';
  orderMessage.classList.remove('success');
  pintarPos();
  orderDialog.showModal();
});

$('#order-close').addEventListener('click', () => orderDialog.close());
orderDialog.addEventListener('click', (event) => {
  if (event.target === orderDialog) orderDialog.close();
});

$('#pos-products').addEventListener('click', (event) => {
  const tarjeta = event.target.closest('[data-producto]');
  if (!tarjeta) return;
  const producto = PRODUCTOS[Number(tarjeta.dataset.producto)];
  const item = pos.get(producto.name) || { ...producto, quantity: 0 };
  item.quantity += 1;
  pos.set(producto.name, item);
  pintarPos();
});

$('#pos-lines').addEventListener('click', (event) => {
  const control = event.target.closest('button[data-pos]');
  if (!control) return;
  const nombre = control.closest('.pos-line').dataset.nombre;
  const item = pos.get(nombre);
  if (!item) return;
  item.quantity += Number(control.dataset.pos);
  if (item.quantity <= 0) pos.delete(nombre);
  pintarPos();
});

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const datos = new FormData(orderForm);
  const pedido = {
    customer: {
      name: datos.get('name').trim() || 'Cliente en mostrador',
      phone: 'Mostrador',
      address: 'Mostrador',
      notes: datos.get('notes').trim(),
    },
    items: [...pos.values()].map(({ name, price, quantity }) => ({ name, price, quantity })),
  };

  orderSubmit.disabled = true;
  orderSubmit.textContent = 'Registrando…';
  try {
    const guardado = await api('/pedidos/', { method: 'POST', body: JSON.stringify(pedido) });
    orderMessage.textContent = `Pedido #${guardado.id} registrado y enviado a cocina.`;
    orderMessage.classList.add('success');
    pos.clear();
    pintarPos();
    await cargarVista();
    setTimeout(() => orderDialog.close(), 1400);
  } catch (error) {
    if (error instanceof SesionVencida) { orderDialog.close(); manejarError(error); return; }
    orderMessage.textContent = error.message;
    orderMessage.classList.remove('success');
  } finally {
    orderSubmit.textContent = 'Registrar pedido';
    orderSubmit.disabled = pos.size === 0;
  }
});

const diasSelect = $('#dias-select');
const estadoFilter = $('#estado-filter');

diasSelect.addEventListener('change', () => cargarVista());
estadoFilter.addEventListener('change', () => cargarVista());

async function cargarResumen() {
  const filtro = estadoFilter.value ? `&estado=${estadoFilter.value}` : '';
  const [resumen, pedidos] = await Promise.all([
    api(`/reportes/resumen/?dias=${diasSelect.value}`),
    api(`/pedidos/?limite=25${filtro}`),
  ]);

  $('#stat-ventas').textContent = formatMoney(resumen.hoy.ventas);
  $('#stat-pedidos').textContent = resumen.hoy.pedidos;
  $('#stat-ticket').textContent = formatMoney(resumen.hoy.ticket_promedio);
  $('#stat-curso').textContent = resumen.en_curso;

  $('#chart-title').textContent = `Ventas por día · últimos ${diasSelect.value} días`;
  pintarGrafico(resumen.ventas_por_dia);
  pintarTop(resumen.top_productos);

  $('#admin-orders').innerHTML = pedidos.length
    ? pedidos.map((p) => `
        <tr>
          <td>#${p.id}</td>
          <td>${escapeHtml(new Date(p.creado_en).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' }))}</td>
          <td>${escapeHtml(p.cliente_nombre)}</td>
          <td class="items">${escapeHtml(resumenProductos(p))}</td>
          <td class="num">${formatMoney(p.total)}</td>
          <td>${badge(p.estado)}</td>
        </tr>`).join('')
    : '<tr><td colspan="6"><p class="empty">No hay pedidos con ese filtro.</p></td></tr>';
}

function pintarTop(top) {
  const lista = $('#top-list');
  if (!top.length) {
    lista.innerHTML = '<li><p class="empty">Aún no hay ventas en este período.</p></li>';
    return;
  }
  const maximo = Math.max(...top.map((t) => t.cantidad));
  lista.innerHTML = top.map((t) => `
    <li>
      <div class="top-row"><span>${escapeHtml(t.producto)}</span><span>${t.cantidad} vendidos · ${formatMoney(t.ingresos)}</span></div>
      <div class="top-bar"><i style="width:${(t.cantidad / maximo) * 100}%"></i></div>
    </li>`).join('');
}

const chart = $('#sales-chart');
const chartTip = $('#chart-tip');

function escalaBonita(valor) {
  if (valor <= 0) return 1000;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const paso = [1, 2, 2.5, 5, 10].find((m) => m * potencia >= valor) || 10;
  return paso * potencia;
}

function pintarGrafico(dias) {
  const ancho = chart.clientWidth || 600;
  const alto = chart.clientHeight || 240;
  const margen = { arriba: 22, derecha: 8, abajo: 26, izquierda: 52 };
  const areaAncho = ancho - margen.izquierda - margen.derecha;
  const areaAlto = alto - margen.arriba - margen.abajo;

  const maximo = escalaBonita(Math.max(...dias.map((d) => d.ventas), 0));
  const hueco = areaAncho / dias.length;
  const barra = Math.max(4, Math.min(38, hueco - 6));
  const cadaEtiqueta = Math.ceil(dias.length / 10);  // máximo ~10 fechas en el eje
  const indiceMayor = dias.reduce((m, d, i) => (d.ventas > dias[m].ventas ? i : m), 0);

  const y = (v) => margen.arriba + areaAlto - (v / maximo) * areaAlto;
  const etiquetaFecha = (iso) => {
    const [, mes, dia] = iso.split('-');
    return `${dia}/${mes}`;
  };

  let svg = '';
  let zonas = '';   

  
  [0, 0.5, 1].forEach((f) => {
    const valor = maximo * f;
    svg += `<line class="grid-line" x1="${margen.izquierda}" x2="${ancho - margen.derecha}" y1="${y(valor)}" y2="${y(valor)}"/>`;
    const texto = valor === 0 ? '0' : `${(valor / 1000).toLocaleString('es-DO', { maximumFractionDigits: 1 })}k`;
    svg += `<text class="axis-label" x="${margen.izquierda - 8}" y="${y(valor) + 4}" text-anchor="end">${texto}</text>`;
  });

  dias.forEach((d, i) => {
    const centro = margen.izquierda + hueco * i + hueco / 2;
    const altoBarra = Math.max(d.ventas > 0 ? 3 : 0, (d.ventas / maximo) * areaAlto);
    const x = centro - barra / 2;
    const top = margen.arriba + areaAlto - altoBarra;
    const r = Math.min(4, barra / 2, altoBarra);

    
    const forma = altoBarra > 0
      ? `M${x},${top + altoBarra} V${top + r} Q${x},${top} ${x + r},${top} H${x + barra - r} Q${x + barra},${top} ${x + barra},${top + r} V${top + altoBarra} Z`
      : '';

    
    zonas += `<rect class="bar-hit" x="${centro - hueco / 2}" y="${margen.arriba}" width="${hueco}" height="${areaAlto}" data-i="${i}"/>`;
    if (forma) svg += `<path class="bar" d="${forma}" data-i="${i}"/>`;

    
    if ((i === indiceMayor && d.ventas > 0) || (i === dias.length - 1 && d.ventas > 0 && i !== indiceMayor)) {
      svg += `<text class="value-label" x="${centro}" y="${top - 6}" text-anchor="middle">${formatMoney(d.ventas)}</text>`;
    }

    if (i % cadaEtiqueta === 0 || i === dias.length - 1) {
      const texto = i === dias.length - 1 ? 'Hoy' : etiquetaFecha(d.fecha);
      svg += `<text class="axis-label" x="${centro}" y="${alto - 6}" text-anchor="middle">${texto}</text>`;
    }
  });

  const totalPeriodo = dias.reduce((s, d) => s + d.ventas, 0);
  chart.innerHTML = `<svg viewBox="0 0 ${ancho} ${alto}" role="img"
      aria-label="Ventas por día. Total del período: ${formatMoney(totalPeriodo)}">${svg}${zonas}</svg>`;

  
  chart.querySelectorAll('.bar-hit').forEach((zona) => {
    zona.addEventListener('mouseenter', () => {
      const d = dias[Number(zona.dataset.i)];
      chart.querySelector(`.bar[data-i="${zona.dataset.i}"]`)?.classList.add('active');
      const caja = zona.getBoundingClientRect();
      const panel = chart.parentElement.getBoundingClientRect();
      chartTip.innerHTML = `<b>${formatMoney(d.ventas)}</b>${d.pedidos} pedido${d.pedidos === 1 ? '' : 's'} · ${etiquetaFecha(d.fecha)}`;
      chartTip.style.left = `${caja.left - panel.left + caja.width / 2}px`;
      chartTip.style.top = `${y(d.ventas) + (chart.getBoundingClientRect().top - panel.top) - 10}px`;
      chartTip.hidden = false;
    });
    zona.addEventListener('mouseleave', () => {
      chartTip.hidden = true;
      chart.querySelectorAll('.bar.active').forEach((b) => b.classList.remove('active'));
    });
  });
}

// Redibuja el gráfico si cambia el tamaño de la ventana
let redimension;
window.addEventListener('resize', () => {
  clearTimeout(redimension);
  redimension = setTimeout(() => { if (vistaActual === 'resumen') cargarVista(); }, 250);
});


(async function iniciar() {
  const guardada = almacen.leer('foodDriveSesion');
  if (!guardada?.token) return;   // se queda en el login

  sesion = guardada;
  try {
    const yo = await api('/auth/me/');
    sesion = { ...sesion, rol: yo.rol, nombre: yo.nombre };
    abrirPanel();
  } catch (error) {
    if (error instanceof SesionVencida) {
      cerrarSesion();
    } else {
      cerrarSesion(error.message);
    }
  }
})();