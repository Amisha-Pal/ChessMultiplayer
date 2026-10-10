from channels.generic.websocket import AsyncWebsocketConsumer
import json

class ChessConsumer(AsyncWebsocketConsumer):
    rooms = {}

    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chess_{self.room_name}"

        # Room create karo
        if self.room_name not in ChessConsumer.rooms:
            ChessConsumer.rooms[self.room_name] = []

        # Maximum 2 players
        if len(ChessConsumer.rooms[self.room_name]) >= 2:
            await self.accept()

            await self.send(
                text_data=json.dumps({
                    "type": "room_full",
                    "message": "Room is full. Maximum 2 players allowed."
                })
            )

            await self.close()
            return

        # Player color assign karo
        if len(ChessConsumer.rooms[self.room_name]) == 0:
            self.color = "white"
        else:
            self.color = "black"

        # Player ko room mein add karo
        ChessConsumer.rooms[self.room_name].append(
            self.channel_name
        )

        # WebSocket group join karo
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        player_count = len(
            ChessConsumer.rooms[self.room_name]
        )

        # Player ka color bhejo
        await self.send(
            text_data=json.dumps({
                "type": "player",
                "color": self.color
            })
        )

        # Room status update karo
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "room_status",
                "players": player_count,
            }
        )

        print(
            f"Player joined: {self.color} | "
            f"Room: {self.room_name} | "
            f"Players: {player_count}"
        )

    async def disconnect(self, close_code):

        if self.room_name in ChessConsumer.rooms:

            if self.channel_name in ChessConsumer.rooms[self.room_name]:
                ChessConsumer.rooms[self.room_name].remove(
                    self.channel_name
                )

            remaining_players = len(
                ChessConsumer.rooms[self.room_name]
            )

            # Room empty hai
            if remaining_players == 0:
                del ChessConsumer.rooms[self.room_name]

            else:
                # Opponent ko disconnect message bhejo
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "opponent_disconnected",
                        "player": self.color,
                    }
                )

                # Room status update karo
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "room_status",
                        "players": remaining_players,
                    }
                )

        # WebSocket group se remove karo
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):

        data = json.loads(text_data)

        print("Received:", data)

        # Resign handle karo
        if data.get("type") == "resign":

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "game_resigned",
                    "player": self.color,
                }
            )

            return

        # New game handle karo
        if data.get("type") == "new_game":

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "new_game",
                }
            )

            return

        # Normal chess move
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chess_move",
                "move": data.get("move"),
                "player": self.color,
                "sender": self.channel_name,
            }
        )

    async def chess_move(self, event):

        # Apna move khud ko wapas mat bhejo
        if event["sender"] == self.channel_name:
            return

        await self.send(
            text_data=json.dumps({
                "type": "move",
                "move": event["move"],
                "player": event["player"],
            })
        )

    async def game_resigned(self, event):

        winner = (
            "black"
            if event["player"] == "white"
            else "white"
        )

        await self.send(
            text_data=json.dumps({
                "type": "resign",
                "player": event["player"],
                "winner": winner,
            })
        )

    async def new_game(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "new_game",
            })
        )

    async def room_status(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "room_status",
                "players": event["players"],
            })
        )

    async def opponent_disconnected(self, event):

        await self.send(
            text_data=json.dumps({
                "type": "opponent_disconnected",
                "player": event["player"],
            })
        )