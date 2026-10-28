from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand

from pedidos.roles import ROLES


class Command(BaseCommand):
    help = "Crea los grupos Cajero, Chef y Administrador. Con --demo crea también un usuario por rol."

    def add_arguments(self, parser):
        parser.add_argument(
            "--demo",
            metavar="CLAVE",
            help="Crea los usuarios cajero, chef y admin con esta contraseña.",
        )

    def handle(self, *args, **options):
        for rol in ROLES:
            _, creado = Group.objects.get_or_create(name=rol)
            self.stdout.write(f"Grupo {rol}: {'creado' if creado else 'ya existía'}")

        contrasena = options.get("demo")
        if not contrasena:
            return

        usuarios = {"cajero": "Cajero", "chef": "Chef", "admin": "Administrador"}
        for nombre, rol in usuarios.items():
            usuario, creado = User.objects.get_or_create(username=nombre)
            usuario.set_password(contrasena)
            usuario.is_staff = rol == "Administrador"
            usuario.save()
            usuario.groups.set([Group.objects.get(name=rol)])
            accion = "creado" if creado else "actualizado"
            self.stdout.write(self.style.SUCCESS(f"Usuario {nombre} ({rol}): {accion}"))
