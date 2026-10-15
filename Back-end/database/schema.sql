-- Food Drive: estructura de la base de datos (SQL Server)

CREATE DATABASE hamburgueseria;
GO
USE hamburgueseria;
GO

CREATE TABLE pedidos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  cliente_nombre NVARCHAR(120) NOT NULL,
  cliente_telefono NVARCHAR(30) NOT NULL,
  direccion_entrega NVARCHAR(255) NOT NULL,
  notas NVARCHAR(MAX) NULL,
  total DECIMAL(10,2) NOT NULL,
  moneda CHAR(3) NOT NULL DEFAULT 'DOP',
  estado NVARCHAR(20) NOT NULL DEFAULT 'pendiente',
  creado_en DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE detalle_pedido (
  id INT IDENTITY(1,1) PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto NVARCHAR(100) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  cantidad SMALLINT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_detalle_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);
GO
