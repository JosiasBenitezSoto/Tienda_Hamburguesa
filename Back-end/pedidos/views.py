from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import PedidoSerializer


@api_view(["POST"])
def crear_pedido(request):
    serializer = PedidoSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    pedido = serializer.save()
    return Response({"id": pedido.id, "total": str(pedido.total)}, status=status.HTTP_201_CREATED)