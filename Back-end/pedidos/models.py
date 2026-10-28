from django.db import models


# Estados por los que pasa un pedido, en orden
PENDIENTE = "pendiente"
EN_PREPARACION = "en_preparacion"
LISTO = "listo"
ENTREGADO = "entregado"
CANCELADO = "cancelado"

ESTADOS = [
    (PENDIENTE, "Pendiente"),
    (EN_PREPARACION, "En preparación"),
    (LISTO, "Listo"),
    (ENTREGADO, "Entregado"),
    (CANCELADO, "Cancelado"),
]

# A qué estados puede pasar un pedido desde cada estado
TRANSICIONES = {
    PENDIENTE: {EN_PREPARACION, CANCELADO},
    EN_PREPARACION: {LISTO, CANCELADO},
    LISTO: {ENTREGADO},
    ENTREGADO: set(),
    CANCELADO: set(),
}

# Estados en los que el pedido todavía se está trabajando
ACTIVOS = [PENDIENTE, EN_PREPARACION, LISTO]


class Pedido(models.Model):
    cliente_nombre = models.CharField(max_length=120)
    cliente_telefono = models.CharField(max_length=30)
    direccion_entrega = models.CharField(max_length=255)
    notas = models.TextField(blank=True, null=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, default="DOP")
    estado = models.CharField(max_length=20, choices=ESTADOS, default=PENDIENTE)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "pedidos"

    def __str__(self):
        return f"Pedido #{self.id} - {self.cliente_nombre}"


class DetallePedido(models.Model):
    pedido = models.ForeignKey(
        Pedido, on_delete=models.CASCADE, related_name="detalles", db_column="pedido_id"
    )
    producto = models.CharField(max_length=100)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    cantidad = models.PositiveSmallIntegerField()
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False
        db_table = "detalle_pedido"

    def __str__(self):
        return f"{self.cantidad} x {self.producto}"