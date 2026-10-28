"""Roles del sistema y permisos según el rol del usuario."""
from rest_framework.permissions import BasePermission

from .models import CANCELADO, EN_PREPARACION, ENTREGADO, LISTO

CAJERO = "Cajero"
CHEF = "Chef"
ADMINISTRADOR = "Administrador"
ROLES = [CAJERO, CHEF, ADMINISTRADOR]

# Estados a los que cada rol puede mover un pedido
ESTADOS_POR_ROL = {
    CHEF: {EN_PREPARACION, LISTO},
    CAJERO: {ENTREGADO, CANCELADO},
    ADMINISTRADOR: {EN_PREPARACION, LISTO, ENTREGADO, CANCELADO},
}


def obtener_rol(user):
    """Devuelve el rol del usuario (nombre del grupo) o None si no tiene."""
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return ADMINISTRADOR
    nombres = set(user.groups.values_list("name", flat=True))
    for rol in (ADMINISTRADOR, CAJERO, CHEF):  # el de más permisos primero
        if rol in nombres:
            return rol
    return None


class TieneRol(BasePermission):
    """Permite el acceso solo a los roles indicados en la vista (roles_permitidos)."""

    message = "Tu usuario no tiene permiso para esta sección."

    def has_permission(self, request, view):
        permitidos = getattr(view, "roles_permitidos", ROLES)
        return obtener_rol(request.user) in permitidos