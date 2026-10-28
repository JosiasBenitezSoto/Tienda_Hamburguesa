from datetime import timedelta

from django.contrib.auth import authenticate
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ACTIVOS, CANCELADO, DetallePedido, Pedido, TRANSICIONES
from .roles import ADMINISTRADOR, ESTADOS_POR_ROL, ROLES, TieneRol, obtener_rol
from .serializers import CambioEstadoSerializer, PedidoLecturaSerializer, PedidoSerializer


def inicio_del_dia(dias_atras=0):
    """Medianoche (hora local de Santo Domingo) de hoy, o de hace N días."""
    ahora = timezone.localtime()
    medianoche = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    return medianoche - timedelta(days=dias_atras)


# =====================================================================
# Login
# =====================================================================

class LoginView(APIView):
    """POST /api/auth/login/  {username, password} -> {token, usuario, nombre, rol}"""

    permission_classes = [AllowAny]

    def post(self, request):
        usuario = authenticate(
            username=request.data.get("username", ""),
            password=request.data.get("password", ""),
        )
        if usuario is None:
            return Response(
                {"detail": "Usuario o contraseña incorrectos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rol = obtener_rol(usuario)
        if rol is None:
            return Response(
                {"detail": "Tu usuario no tiene un rol asignado. Pide al administrador que te asigne uno."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token, _ = Token.objects.get_or_create(user=usuario)
        return Response({
            "token": token.key,
            "usuario": usuario.username,
            "nombre": usuario.get_full_name() or usuario.username,
            "rol": rol,
        })


class LogoutView(APIView):
    """POST /api/auth/logout/  Borra el token: hay que volver a iniciar sesión."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/auth/me/  Quién soy y qué rol tengo."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "usuario": u.username,
            "nombre": u.get_full_name() or u.username,
            "rol": obtener_rol(u),
        })


# =====================================================================
# Pedidos
# =====================================================================

class PedidoListCreateView(APIView):
    """
    POST /api/pedidos/  Crear pedido. Público: lo usa la tienda.
    GET  /api/pedidos/  Listar pedidos. Solo empleados.
        ?estado=pendiente,en_preparacion   filtra por uno o varios estados
        ?desde=hoy                         solo los de hoy
        ?orden=antiguos                    los más viejos primero (cocina)
        ?limite=50                         cuántos devolver (máx. 200)
    """

    roles_permitidos = ROLES

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsAuthenticated(), TieneRol()]

    def post(self, request):
        serializer = PedidoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(
            {"id": pedido.id, "total": str(pedido.total)},
            status=status.HTTP_201_CREATED,
        )

    def get(self, request):
        pedidos = Pedido.objects.prefetch_related("detalles")

        estados = request.query_params.get("estado")
        if estados:
            pedidos = pedidos.filter(estado__in=estados.split(","))

        if request.query_params.get("desde") == "hoy":
            pedidos = pedidos.filter(creado_en__gte=inicio_del_dia())

        orden = "creado_en" if request.query_params.get("orden") == "antiguos" else "-creado_en"
        pedidos = pedidos.order_by(orden)

        try:
            limite = min(int(request.query_params.get("limite", 100)), 200)
        except ValueError:
            limite = 100

        return Response(PedidoLecturaSerializer(pedidos[:limite], many=True).data)


class PedidoEstadoView(APIView):
    """PATCH /api/pedidos/<id>/estado/  {estado}  Cambia el estado según el rol."""

    permission_classes = [IsAuthenticated, TieneRol]
    roles_permitidos = ROLES

    def patch(self, request, pk):
        serializer = CambioEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nuevo = serializer.validated_data["estado"]

        try:
            pedido = Pedido.objects.get(pk=pk)
        except Pedido.DoesNotExist:
            return Response({"detail": "El pedido no existe."}, status=status.HTTP_404_NOT_FOUND)

        rol = obtener_rol(request.user)
        if nuevo not in ESTADOS_POR_ROL.get(rol, set()):
            return Response(
                {"detail": f"El rol {rol} no puede marcar pedidos como '{nuevo}'."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if nuevo not in TRANSICIONES.get(pedido.estado, set()):
            return Response(
                {"detail": f"Un pedido '{pedido.estado}' no puede pasar a '{nuevo}'."},
                status=status.HTTP_409_CONFLICT,
            )

        pedido.estado = nuevo
        pedido.save(update_fields=["estado"])
        return Response(PedidoLecturaSerializer(pedido).data)


# =====================================================================
# Reportes (administrador)
# =====================================================================

class ResumenView(APIView):
    """GET /api/reportes/resumen/?dias=7  Ventas e indicadores para el administrador."""

    permission_classes = [IsAuthenticated, TieneRol]
    roles_permitidos = [ADMINISTRADOR]

    def get(self, request):
        try:
            dias = max(1, min(int(request.query_params.get("dias", 7)), 90))
        except ValueError:
            dias = 7

        hoy = inicio_del_dia()
        validos = Pedido.objects.exclude(estado=CANCELADO)

        # --- Indicadores de hoy ---
        de_hoy = validos.filter(creado_en__gte=hoy)
        datos_hoy = de_hoy.aggregate(ventas=Sum("total"), pedidos=Count("id"))
        ventas_hoy = float(datos_hoy["ventas"] or 0)
        pedidos_hoy = datos_hoy["pedidos"] or 0

        por_estado = {
            fila["estado"]: fila["n"]
            for fila in Pedido.objects.filter(creado_en__gte=hoy)
            .values("estado").annotate(n=Count("id"))
        }

        # --- Ventas por día (se agrupa en Python para respetar la hora local) ---
        desde = inicio_del_dia(dias - 1)
        por_dia = {}
        for i in range(dias):
            fecha = (desde + timedelta(days=i)).date()
            por_dia[fecha] = {"fecha": fecha.isoformat(), "ventas": 0.0, "pedidos": 0}

        for creado, total in validos.filter(creado_en__gte=desde).values_list("creado_en", "total"):
            fecha = timezone.localtime(creado).date()
            if fecha in por_dia:
                por_dia[fecha]["ventas"] += float(total)
                por_dia[fecha]["pedidos"] += 1

        # --- Productos más vendidos en el período ---
        top = (
            DetallePedido.objects
            .filter(pedido__creado_en__gte=desde)
            .exclude(pedido__estado=CANCELADO)
            .values("producto")
            .annotate(cantidad=Sum("cantidad"), ingresos=Sum("subtotal"))
            .order_by("-cantidad")[:5]
        )

        return Response({
            "hoy": {
                "ventas": ventas_hoy,
                "pedidos": pedidos_hoy,
                "ticket_promedio": round(ventas_hoy / pedidos_hoy, 2) if pedidos_hoy else 0,
                "por_estado": por_estado,
            },
            "en_curso": Pedido.objects.filter(estado__in=ACTIVOS).count(),
            "ventas_por_dia": list(por_dia.values()),
            "top_productos": [
                {"producto": t["producto"], "cantidad": t["cantidad"], "ingresos": float(t["ingresos"])}
                for t in top
            ],
        })