<template>
<div>
  <div class="player-over">
    <h3 >
      Players:
    </h3>
    <ul>
      <li v-for="u in users" :class="(user.userid === u.userid?'self':'') + ' ' + (u.userid === atRow?'atRow':'')">{{u.username}}</li>
    </ul>
  </div>
  <div class="controls-over">
    <h3>Controls:</h3>
    <button v-if="!isConnected" @click="connect" :disabled="isConnected">Connect to the server</button>
    <button style="margin-bottom: 20px" v-if="isConnected" @click="ws?.close()" :disabled="!isConnected">Disconnect from the server</button>
    <form v-if="isConnected && user === null" @submit.prevent="send(MessageType.JOIN, message.sessionId!, payload)">
      <select v-model="message.sessionId" >
        <option value="" selected>Neue Session</option>
        <option v-for="session in sessions" :value="session">{{session}}</option>
      </select>
      <input v-model="payload.username" type="text" placeholder="Username" required>
      <button type="submit">Join session</button>
    </form>
    <button v-if="isConnected && user !== null" @click="send(MessageType.LEAVE, user?.sessionId!)">Leave the session</button>
    <button v-if="isConnected && !isStarted && user !== null" @click="send(MessageType.START, user.sessionId!)">Start the game</button>
  </div>
<div class="game">
  <h1>Mau Mau</h1>
  <div class="game">
    <div class="stapel">
      <img v-if="!isStarted || !isAtRow" src="../pictures/Rückseite.png">
      <img v-if="isStarted && isAtRow" @click="send(MessageType.DRAWCARD, user?.sessionId!)" src="../pictures/Rückseite.png">
      <img v-if="topCard !== null" :src="topCard.number === CardNumber.BUBE?getImage({symbol: topCard.color, number: CardNumber.BUBE}):getImage(topCard)">
      <img v-if="topCard === null" src="../pictures/Blank.png">
    </div>
    <div v-if="isConnected && user !== null && !isStarted">
      <h3>Waiting for other players</h3>
    </div>

    <div v-if="isConnected && user !== null && isStarted">
      <h3 v-if="isAtRow && win === null">You are at row</h3>
      <h3 v-if="!isAtRow && win === null">{{users!.find((u)=> u.userid == atRow).username}} is at row</h3>
      <h3 v-if="win === true">You won</h3>
      <h3 v-if="win === false">You lost</h3>
    </div>
    <div v-if="isConnected && user !== null && isStarted && isAtRow">
      <button @click="send(MessageType.KANNNICHT, user?.sessionId!)">Kann nicht</button>
    </div>
    <div v-if="isConnected && user !== null && isStarted" class="card-box">
      <div v-for="c in cards" class="card-img">
        <img :class="isAtRow?'auswahl-img':''" @click="isAtRow?(c?.number !== CardNumber.BUBE?send(MessageType.PLAYCARD, user?.sessionId!, {number: c?.number, symbol: c?.symbol}):null):null" :src="getImage(c)">
        <div v-if="c.number === CardNumber.BUBE" class="card-img-auswahl">
          <button><img src="../pictures/Pik.png" @click="isAtRow?send(MessageType.PLAYCARD, user?.sessionId!, {number: c?.number, symbol: c?.symbol, color: CardSymbol.PIK}):null"></button>
          <button><img src="../pictures/Herz.png" @click="isAtRow?send(MessageType.PLAYCARD, user?.sessionId!, {number: c?.number, symbol: c?.symbol, color: CardSymbol.HERZ}):null"></button>
          <button><img src="../pictures/Karo.png" @click="isAtRow?send(MessageType.PLAYCARD, user?.sessionId!, {number: c?.number, symbol: c?.symbol, color: CardSymbol.KARO}):null"></button>
          <button><img src="../pictures/Kreuz.png" @click="isAtRow?send(MessageType.PLAYCARD, user?.sessionId!, {number: c?.number, symbol: c?.symbol, color: CardSymbol.KREUZ}):null"></button>
        </div>
      </div>
    </div>
  </div>
</div>
</div>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import {CardNumber, CardSymbol, MessageType} from "@/helpers/enums";
import {Card, Client, Message, Payload} from "@/helpers/types";


const isAtRow = ref(false);
const isStarted = ref(false);
const isConnected = ref(false);
const users = ref<Client[]>([]);
const sessions = ref<string[]>([]);
const cards = ref<Card[]>([]);
const user = ref<Client|null>(null);
const topCard = ref<Card|null>(null);
const atRow = ref<string|null>(null);
const win = ref<boolean|null>(null);
const message = ref<Message>({sessionId: ''});
const payload = ref<Payload>({});

function getImage(card: Card) {
  return `src/pictures/${card.symbol.charAt(0).toUpperCase() + card.symbol.slice(1).toLowerCase()}-${card.number}.png`;
}

let ws = null as WebSocket | null;

function connect() {
  ws = new WebSocket('ws://localhost:8080');
  ws.onopen = onOpen;
  ws.onmessage = onMessage;
  ws.onclose = onClose;
  ws.onerror = onError;
}

function disconnect() {
  if (ws) {
    ws.close();
  }
  isConnected.value = false;
}

function onOpen() {
  console.log('WebSocket connection established');
  isConnected.value = true;
}

function onClose() {
  console.log('WebSocket connection closed');
  isConnected.value = false;
  users.value = [];
  sessions.value = [];
  cards.value = [];
  user.value = null;
  topCard.value = null;
  atRow.value = null;
  isAtRow.value = false;
  isStarted.value = false;
  win.value = null;
  message.value = {sessionId: ''};
  payload.value = {};
}

function onMessage(event: MessageEvent) {
  const data = JSON.parse(event.data) as Message;
  console.log('WebSocket message received:', data);
  switch (data.type) {
    case MessageType.SESSIONS:
      console.log("Sessions");
      sessions.value = data.payload;
      break;
    case MessageType.NEWSESSION:
      console.log("New session");
      sessions.value.push(data.payload);
      break;
    case MessageType.REMOVESESSION:
      console.log("Remove session");
      sessions.value = sessions.value.filter(session => session !== data.payload);
      break;
    case MessageType.USERS:
      console.log("Users");
      users.value = data.payload;
      break;
    case MessageType.JOINED:
      console.log("User joined");
      users.value!.push(data.payload);
      break;
    case MessageType.LEFT:
      console.log("User left");
      const newUsers = users.value!.filter(client => client.userid !== data.payload.userid);
      if(data.payload.userid === user.value?.userid) {
        users.value = [];
        cards.value = [];
        user.value = null;
        topCard.value = null;
        atRow.value = null;
        isAtRow.value = false;
        isStarted.value = false;
        win.value = null;
        message.value = {sessionId: ''};
        payload.value = {};
      }
      users.value = newUsers;
      break;
    case MessageType.STARTED:
      console.log("Game started");
      isStarted.value = true;
      break;
    case MessageType.CARDS:
      console.log("Cards");
      cards.value = data.payload;
      break;
    case MessageType.CARD:
      console.log("Card")
      cards.value.push(data.payload);
      break;
    case MessageType.USER:
      console.log("User");
      user.value = data.payload;
      break;
    case MessageType.PLAYEDCARD:
      console.log("Top card");
      topCard.value = data.payload;
      break;
    case MessageType.ATROW:
      console.log("At row");
      atRow.value = data.payload.userid;
      isAtRow.value = data.payload.userid === user.value?.userid;
      break;
    case MessageType.YOUPLAYEDCARD:
      console.log("You played a card");
      console.log(cards.value);
      cards.value = cards.value.filter(card => !(card.number === data.payload.number && card.symbol === data.payload.symbol));
      console.log(cards.value);
      break;
    case MessageType.LOSE:
      console.log("You lost");
      cards.value = [];
      topCard.value = null;
      atRow.value = null;
      isAtRow.value = false;
      win.value = false;
      break;
    case MessageType.WIN:
      console.log("You won");
      cards.value = [];
      topCard.value = null;
      atRow.value = null;
      isAtRow.value = false;
      win.value = true;
      break;


  }
}

function onError(event: Event) {
  console.log('WebSocket error observed:', event);
  disconnect();
}
function send(type: MessageType, sessionId: string, payload?: Payload) {
  if (ws) {
    if(payload) {
      ws.send(JSON.stringify({type: type, sessionId: sessionId, payload: payload}));
    } else {
      ws.send(JSON.stringify({type: type, sessionId: sessionId}));
    }
  }
}
</script>
<style scoped>
.stapel {
  min-height: 40vh;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.game {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

#start-button {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.card-box {
  height: 110%;
  border-radius: 10px;
  border: black solid 2px;
  max-width: 90vw;
  min-width: 100%;
  display: block ruby;
  flex-direction: row;
  justify-content: center;
  overflow-x: scroll;
  overflow-y: hidden;
}

.card-box img {
  width: 100px;
  height: 150px;
  padding: 10px;
}

.card-img:hover {
  cursor: pointer;
  transform: scale(1.1);
}

.controls-over {
  overflow: scroll;
  width: 20vw;
  height: 50vh;
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: white;
  padding: 10px;
  border-radius: 10px;
  border: black solid 2px;
  justify-content: center;
  align-items: center;
}

.controls-over h3 {
  margin: 0;
  padding: 10px;
  text-align: center;
}

.controls-over button {
  width: 100%;
  padding: 10px;
  margin-top: 15px;
  border-radius: 10px;
  border: black solid 2px;
  font-weight: bold;
}

.controls-over form {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 15px;
  margin-bottom: 15px;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  border: black solid 2px;
}

.controls-over form input {
  width: calc(100% - 20px);
  padding: 10px;
  border-radius: 10px;
  border: black solid 2px;
  font-weight: bold;
}

.controls-over form select {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: black solid 2px;
  font-weight: bold;
}

.controls-over form select option {
  padding: 10px;
  border-radius: 10px;
  border: black solid 2px;
  font-weight: bold;
}

.controls-over form button {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: black solid 2px;
  font-weight: bold;
}

.player-over {
  overflow: scroll;
  width: 20vw;
  height: 50vh;
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: white;
  padding: 10px;
  border-radius: 10px;
  border: black solid 2px;
}
.player-over h3 {
  margin: 0;
  padding: 10px;
  text-align: center;
}
.player-over ul {
  list-style-type: none;
  padding: 10px;
}

.player-over ul li {
  padding: 10px;
  margin: 10px;
  border-radius: 10px;
  border: black solid 2px;
  text-align: center;
  font-weight: bold;
}

.self {
  color: red;
  background-color: lightblue;
  border-radius: 10px;
  padding: 5px;
  margin: 5px;
  text-align: center;
  font-weight: bold;
  border: black solid 2px;
}
.atRow {
  background-color: lightgreen;
  border-radius: 10px;
  padding: 5px;
  margin: 5px;
  text-align: center;
  font-weight: bold;
  border: black solid 2px;
}

.card-img {
  position: relative;
  width: 100px;
  height: 150px;
  padding: 10px;
}

.card-img img {
  position: absolute;
  top: 0;
  left: 0;
  transition: transform 0.5s;
}

.card-img-auswahl {
  position: absolute;
  width: 120px;
  height: 170px;
  top: 0px;
  left: 0;
  flex-direction: row;
  z-index: 100;
}

.card-img-auswahl:hover + img {
  transform: scale(1.1);
}

.card-img-auswahl:hover {
  transform: scale(1.1);
  button {
    cursor: pointer;
    visibility: visible;
    :hover {
      transform: scale(1.1);
    }
  }
}


.card-img-auswahl button {
  visibility: hidden;
  width: 30px;
  height: 30px;
  padding: 0;
  margin: 0;
  border: none;
  display: flex;
  background-color: transparent;
}

.card-img-auswahl button:nth-child(1) {
  position: absolute;
  top: 15px;
  left: 15px;
}
.card-img-auswahl button:nth-child(2) {
  position: absolute;
  top: 15px;
  right: 18px;
}
.card-img-auswahl button:nth-child(3) {
  position: absolute;
  bottom: 15px;
  left: 15px;
}
.card-img-auswahl button:nth-child(4) {
  position: absolute;
  bottom: 15px;
  right: 18px;
}

.card-img-auswahl button img {
  position: relative;
  width: 30px;
  height:30px;
  padding: 0;
  margin: 0;
  background-color: transparent;
  border-radius: 5px;
  border: black solid 2px;
}

</style>