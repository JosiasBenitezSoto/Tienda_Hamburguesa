# 🍔 Food Drive: tienda de hamburguesas

Sistema web para una hamburguesería. El cliente ve el menú, arma su carrito,
llena sus datos de entrega y envía el pedido, que queda guardado en SQL Server.

Proyecto de **Ingeniería de Software 1**, basado en el trabajo final de
Análisis y Diseño de Sistemas.

## Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, Django, Django REST Framework, django-cors-headers |
| Base de datos | SQL Server (mssql-django + ODBC Driver 18) |

## Arquitectura

```
Frontend (navegador) ──POST /api/pedidos/──▶ Backend (Django) ──INSERT──▶ SQL Server
```

- **Frontend:** menú con categorías (Hamburguesas, Burritos, Variedad), carrito
  con cantidades y total en RD$, y formulario de entrega.
- **Backend:** API que valida el pedido, recalcula el total en el servidor y lo
  guarda dentro de una transacción.
- **Base de datos:** tablas `pedidos` y `detalle_pedido` (relación uno a muchos).

## Estructura

```
Front-end/   index.html, styles.css, checkout.css, script.js, images/
Back-end/    config/, pedidos/, database/schema.sql, requirements.txt, .env.example
```

## Cómo ejecutarlo

1. Crear la base y las tablas ejecutando `Back-end/database/schema.sql` en SQL Server.
2. En `Back-end`, crear el entorno virtual e instalar dependencias:
   ```
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Copiar `.env.example` como `.env` y completar los datos de tu servidor.
4. Ejecutar:
   ```
   python manage.py migrate
   python manage.py runserver
   ```
5. Abrir `Front-end/index.html` en el navegador y hacer un pedido.
6. Verificar en SQL Server:
   ```sql
   SELECT * FROM pedidos;
   SELECT * FROM detalle_pedido;
   ```

## API

`POST /api/pedidos/`

```json
{
  "customer": { "name": "Juan Pérez", "phone": "809-555-1234",
                "address": "Av. Principal 123", "notes": "" },
  "items": [ { "name": "La Clásica", "price": 295, "quantity": 2 } ]
}
```

Respuesta `201`: `{ "id": 1, "total": "590.00" }`

## Próximos pasos

- Inicio de sesión de usuarios
- Catálogo de productos en la base de datos
- Panel para gestionar el estado de los pedidos

## Autor

Josias Benitez Soto
