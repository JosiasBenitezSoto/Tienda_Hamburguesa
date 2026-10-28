from django.urls import path

from . import views

urlpatterns = [
    # Login
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.MeView.as_view(), name="me"),

    # Pedidos
    path("pedidos/", views.PedidoListCreateView.as_view(), name="pedidos"),
    path("pedidos/<int:pk>/estado/", views.PedidoEstadoView.as_view(), name="pedido_estado"),

    # Reportes
    path("reportes/resumen/", views.ResumenView.as_view(), name="resumen"),
]