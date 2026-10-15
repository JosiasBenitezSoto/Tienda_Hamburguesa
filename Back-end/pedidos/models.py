from django.db import models


class Pedido(models.Model):
    cliente_nombre = models.CharField(max_length=120)
    cliente_telefono = models.CharField(max_length=30)
    direccion_entrega = models.CharField(max_length=255)
    notas = models.TextField(blank=True, null=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, default="DOP")
    estado = models.CharField(max_length=20, default="pendiente")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "pedidos"


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