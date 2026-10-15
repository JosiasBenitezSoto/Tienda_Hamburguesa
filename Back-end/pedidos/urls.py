from django.urls import path
from .views import crear_pedido

urlpatterns = [
    path("pedidos/", crear_pedido, name="crear_pedido"),
]