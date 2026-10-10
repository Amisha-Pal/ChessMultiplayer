from django.urls import re_path
from .consumers import ChessConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/chess/(?P<room_name>\w+)/$",
        ChessConsumer.as_asgi(),
    ),
]