from decimal import Decimal
from django.db import transaction
from rest_framework import serializers
from .models import Pedido, DetallePedido


class ClienteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=30)
    address = serializers.CharField(max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    quantity = serializers.IntegerField(min_value=1, max_value=99)


class PedidoSerializer(serializers.Serializer):
    customer = ClienteSerializer()
    items = ItemSerializer(many=True, allow_empty=False)

    @transaction.atomic
    def create(self, data):
        cliente, items = data["customer"], data["items"]
        total = sum(i["price"] * i["quantity"] for i in items)

        pedido = Pedido.objects.create(
            cliente_nombre=cliente["name"],
            cliente_telefono=cliente["phone"],
            direccion_entrega=cliente["address"],
            notas=cliente["notes"],
            total=total,
        )
        DetallePedido.objects.bulk_create([
            DetallePedido(
                pedido=pedido,
                producto=i["name"],
                precio_unitario=i["price"],
                cantidad=i["quantity"],
                subtotal=i["price"] * i["quantity"],
            )
            for i in items
        ])
        return pedido