import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

enum MessageType {
  JOIN = 'JOIN',
  JOINED = 'JOINED',
  LEAVE = 'LEAVE',
  LEFT = 'LEFT',
  USER = 'USER',
  USERS = 'USERS',
  SESSIONS = 'SESSIONS',
  NEWSESSION = 'NEWSESSION',
  REMOVESESSION = 'REMOVESESSION',
  START = 'START',
  STARTED = 'STARTED',
  ERROR = 'ERROR',
  CARDS = 'CARDS',
  ATROW = 'ATROW',
  PLAYCARD = 'PLAYCARD',
  DRAWCARD = 'DRAWCARD',
  WIN = 'WIN',
  LOSE = 'LOSE',
  END = 'END',
  MAU = 'MAU',
  KANNNICHT = 'KANNNICHT',
  CARD = 'CARD',
  AUSSETZEN = 'AUSSETZEN',
  PLAYEDCARD = 'PLAYEDCARD',
  YOUPLAYEDCARD = 'YOUPLAYEDCARD',
}
enum CardSymbol {
  KREUZ = 'KREUZ',
  PIK = 'PIK',
  HERZ = 'HERZ',
  KARO = 'KARO',
}
enum CardNumber {
  ASS = 'A',
  ZWEI = '2',
  DREI = '3',
  VIER = '4',
  FÜNF = '5',
  SECHS = '6',
  SIEBEN = '7',
  ACHT = '8',
  NEUN = '9',
  ZEHEN = '10',
  BUBE = 'J',
  DAME = 'Q',
  KÖNIG = 'K',
}

type Message = {
  type: MessageType;
  sessionId?: string;
  payload?: any;
};
type Card = {
  symbol: CardSymbol;
  number: CardNumber;
};

type Client = {
  ws: WebSocket;
  userid: string;
  sessionId?: string;
  username: string;
  cards?: Map<string, Card>;
};
type Session = {
  clients: Set<Client>;
  cards: Card[];
  isStarted: boolean;
  next: number;
  aktivPlayers?: Client[];
  atRow?: Client;
  places?: number;
  gezogen?: boolean;
  topCard?: Card;
  ziehen?: number;
  color?: CardSymbol;
};

//constants
const websocket = new WebSocket.Server({ port: 8080 });
const sessions: Map<string, Session> = new Map();
const connections: Set<WebSocket> = new Set();
const connectionsClientId: Map<WebSocket, string> = new Map();
const deck: Set<Card> = new Set();
const allClients: Map<string, Client> = new Map();

Object.values(CardNumber).forEach((numb) => {
  Object.values(CardSymbol).forEach((symb) => {
    deck.add({
      symbol: symb,
      number: numb,
    });
  });
});

//Websocket
websocket.on('connection', (ws) => {
  console.log('connected');
  connections.add(ws);
  ws.send(JSON.stringify({ type: MessageType.SESSIONS, payload: Array.from(sessions.keys()) }));

  ws.on('message', (messageAsString) => {
    console.log('received: %s', messageAsString);
    const message = JSON.parse(messageAsString.toString()) as Message;
    onMessage(message, ws);
  });

  ws.on('close', () => {
    console.log('closed');
    if (connectionsClientId.has(ws)) {
      const userid = connectionsClientId.get(ws);
      if (allClients.has(userid!)) {
        const client = allClients.get(userid!);
        if (client?.sessionId) {
          leaveSession(ws, { type: MessageType.LEAVE, sessionId: client.sessionId });
        }
      }
    }
    connections.delete(ws);
  });

  ws.on('error', () => {
    console.log('errored');
  });
});

function onMessage(message: Message, ws: WebSocket): void {
  switch (message.type) {
    case MessageType.JOIN:
      if (message.payload && message.payload.username) {
        if (!connectionsClientId.has(ws)) {
          joinSession(ws, message);
        } else {
          ws.send(JSON.stringify({ type: MessageType.ERROR, payload: 'You are already in a session' }));
        }
      } else {
        ws.send(JSON.stringify({ type: MessageType.ERROR, payload: 'Username is missing' }));
      }
      break;
    case MessageType.LEAVE:
      if (connectionsClientId.has(ws)) {
        leaveSession(ws, message);
      } else {
        ws.send(JSON.stringify({ type: MessageType.ERROR, payload: 'You are not in a session' }));
      }
      break;
    case MessageType.START:
      startSession(ws, message);
      break;
    case MessageType.PLAYCARD:
      playCard(ws, message);
      break;
    case MessageType.DRAWCARD:
      drawCard(ws, message);
      break;
    case MessageType.KANNNICHT:
      kannNicht(ws, message);
      break;
    default:
      break;
  }
}

function joinSession(ws: WebSocket, message: Message): void {
  console.log('join');
  if (!sessions.has(message.sessionId || '')) {
    message.sessionId = uuidv4();
    sessions.set(message.sessionId, { clients: new Set(), next: 0, cards: [], isStarted: false });
    connections.forEach((client) => {
      client.send(JSON.stringify({ type: MessageType.NEWSESSION, payload: message.sessionId }));
    });
  }
  const session = sessions.get(message.sessionId!);
  if (!session?.isStarted && session?.clients.size! < 4) {
    const userid = uuidv4();
    const client: Client = {
      ws: ws,
      userid: userid,
      sessionId: message.sessionId,
      username: message.payload.username,
    };
    session?.clients.add(client);
    allClients.set(userid, client);
    ws.send(JSON.stringify({ type: MessageType.USER, payload: { sessionId: client.sessionId, username: client.username, userid: client.userid } }));
    connectionsClientId.set(ws, userid);
    session?.clients.forEach((c) => {
      c.ws.send(JSON.stringify({ type: MessageType.JOINED, payload: { username: client.username, userid: client.userid } }));
    });
    ws.send(
      JSON.stringify({
        type: MessageType.USERS,
        payload: Array.from(session!.clients).map((client) => {
          return { userid: client.userid, username: client.username };
        }),
      }),
    );
  }
}

function leaveSession(ws: WebSocket, message: Message): void {
  console.log('leave');
  const userid = connectionsClientId.get(ws);
  if (sessions.has(message.sessionId || '') && userid) {
    const session = sessions.get(message.sessionId!)!;
    session.clients.forEach((client) => {
      if (client.userid === userid) {
        session.clients.delete(client);
        allClients.delete(userid);
        connectionsClientId.delete(client.ws);
      }
      client.ws.send(JSON.stringify({ type: MessageType.LEFT, payload: { userid: userid } }));
    });
    if (session.clients.size === 0) {
      sessions.delete(message.sessionId!);
      connections.forEach((client) => {
        client.send(JSON.stringify({ type: MessageType.REMOVESESSION, payload: message.sessionId }));
      });
    } else {
      if (session.isStarted) {
        const player = session.aktivPlayers?.find((player) => player.userid === userid);
        if (player) {
          session.aktivPlayers = session.aktivPlayers?.filter((player) => player.userid !== userid);
          session.clients.forEach((c) => {
            c.ws.send(
              JSON.stringify({
                type: MessageType.USERS,
                payload: session.aktivPlayers?.map((ap) => {
                  return { userid: ap.userid, username: ap.username };
                }),
              }),
            );
          });
          if (session.aktivPlayers!.length === 1) {
            session.aktivPlayers![0].ws.send(JSON.stringify({ type: MessageType.LOSE }));
            session.clients.forEach((c) => {
              c.ws.send(JSON.stringify({ type: MessageType.END }));
              c.ws.send(
                JSON.stringify({
                  type: MessageType.USERS,
                  payload: Array.from(session!.clients).map((client) => {
                    return { userid: client.userid, username: client.username };
                  }),
                }),
              );
            });
            session.isStarted = false;
          }
        }
      }
    }
  }
}

function startSession(ws: WebSocket, message: Message): void {
  console.log('start');
  const userid = connectionsClientId.get(ws);
  if (sessions.has(message.sessionId || '') && userid) {
    const session = sessions.get(message.sessionId!)!;
    const client = Array.from(session.clients).find((client) => client.userid === userid);
    if (client) {
      if (session.clients.size > 1) {
        session.isStarted = true;
        session.cards = Array.from(deck).sort(() => Math.random() - 0.5);
        session.aktivPlayers = Array.from(session.clients);
        session.next = Math.floor(Math.random() * session.clients.size);
        session.atRow = session.aktivPlayers![session.next];
        session.places = 1;
        session.gezogen = false;
        session.topCard = session.cards.pop()!;
        session.ziehen = 0;
        session.color = session.topCard.number === CardNumber.BUBE ? CardSymbol.KARO : session.topCard.symbol;
        session.clients.forEach((c) => {
          c.cards = new Map();
          for (let i = 0; i < 5; i++) {
            const card = session.cards.pop()!;
            c.cards?.set(card.number + card.symbol, card);
          }
          c.ws.send(JSON.stringify({ type: MessageType.STARTED }));
          c.ws.send(JSON.stringify({ type: MessageType.CARDS, payload: Array.from(c.cards.values()) }));
          c.ws.send(JSON.stringify({ type: MessageType.ATROW, payload: { userid: session.atRow!.userid } }));
          c.ws.send(JSON.stringify({ type: MessageType.PLAYEDCARD, payload: session.topCard }));
          c.ws.send(
            JSON.stringify({
              type: MessageType.USERS,
              payload: session.aktivPlayers?.map((ap) => {
                return { userid: ap.userid, username: ap.username };
              }),
            }),
          );
        });
      } else {
        ws.send(JSON.stringify({ type: MessageType.ERROR, payload: 'Not enough players' }));
      }
    }
  }
}

function playCard(ws: WebSocket, message: Message) {
  console.log('playCard');
  let end = false;
  const userid = connectionsClientId.get(ws);
  if (sessions.has(message.sessionId || '') && userid) {
    const session = sessions.get(message.sessionId!)!;
    const client = Array.from(session.clients).find((client) => client.userid === userid);
    if (client && session.isStarted && session.atRow?.userid === userid) {
      if (session.ziehen! <= 0 || message.payload.number === CardNumber.SIEBEN) {
        let card = message.payload.number! + message.payload.symbol!;
        if (
          client.cards?.has(card) &&
          ((message.payload.number as CardNumber) != CardNumber.BUBE ||
            ((message.payload.number as CardNumber) === CardNumber.BUBE && message.payload.color))
        ) {
          card = client.cards.get(card)!;
          if (
            ((session.topCard?.number as CardNumber) != CardNumber.BUBE &&
              (card.number == session.topCard?.number || card.symbol == session.topCard?.symbol || card.number == CardNumber.BUBE)) ||
            ((session.topCard?.number as CardNumber) == CardNumber.BUBE && session.color == card.symbol)
          ) {
            const cards = session.cards.reverse();
            cards.push(session.topCard!);
            session.cards = cards.reverse();
            session.topCard = card;
            client.cards.delete(card.number + card.symbol);
            session.gezogen = false;
            if (client.cards.size === 0) {
              ws.send(JSON.stringify({ type: MessageType.WIN, payload: session.places }));
              session.places!++;
              session.aktivPlayers = session.aktivPlayers?.filter((player) => player.userid !== userid);
              session.clients.forEach((c) => {
                c.ws.send(
                  JSON.stringify({
                    type: MessageType.USERS,
                    payload: session.aktivPlayers?.map((ap) => {
                      return { userid: ap.userid, username: ap.username };
                    }),
                  }),
                );
              });
              if (session.aktivPlayers?.length === 1) {
                session.aktivPlayers[0].ws.send(JSON.stringify({ type: MessageType.LOSE }));
                session.clients.forEach((c) => {
                  c.ws.send(JSON.stringify({ type: MessageType.END }));
                  c.ws.send(
                    JSON.stringify({
                      type: MessageType.USERS,
                      payload: session!.clients,
                    }),
                  );
                  c.ws.send(JSON.stringify({ type: MessageType.USERS, payload: session.clients }));
                  end = true;
                });
                session.isStarted = false;
              }
            } else if (client.cards.size === 1) {
              session.clients.forEach((c) => {
                c.ws.send(JSON.stringify({ type: MessageType.MAU, payload: { userid: userid } }));
              });
            }
            if (!end) {
              if (card.number === CardNumber.ACHT) {
                session.next = (session.next + 1) % session.clients.size;
                session.aktivPlayers![session.next].ws.send(JSON.stringify({ type: MessageType.AUSSETZEN }));
                session.next = (session.next + 1) % session.clients.size;
              } else {
                session.next = (session.next + 1) % session.clients.size;
              }
              if (card.number === CardNumber.SIEBEN) {
                session.ziehen = session.ziehen! + 2;
              } else {
                session.ziehen = 0;
              }
              if (card.number === CardNumber.BUBE) {
                session.color = message.payload.color;
              }
              session.atRow = session.aktivPlayers![session.next];
              ws.send(JSON.stringify({ type: MessageType.YOUPLAYEDCARD, payload: card }));
              session.clients.forEach((c) => {
                if (card.number === CardNumber.BUBE) {
                  c.ws.send(
                    JSON.stringify({
                      type: MessageType.PLAYEDCARD,
                      payload: { number: card.number, symbol: card.symbol, color: message.payload.color },
                    }),
                  );
                } else {
                  c.ws.send(
                    JSON.stringify({
                      type: MessageType.PLAYEDCARD,
                      payload: { number: card.number, symbol: card.symbol },
                    }),
                  );
                }
                c.ws.send(
                  JSON.stringify({
                    type: MessageType.ATROW,
                    payload: { userid: session.atRow?.userid },
                  }),
                );
              });
            }
          }
        } else {
          ws.send(JSON.stringify({ type: MessageType.ERROR, payload: "You don't have this card" }));
        }
      } else {
        ws.send(JSON.stringify({ type: MessageType.ERROR, payload: 'You have to draw or place a seven' }));
      }
    } else {
      ws.send(JSON.stringify({ type: MessageType.ERROR, payload: "It's not your turn" }));
    }
  }
}

function drawCard(ws: WebSocket, message: Message) {
  console.log('drawCard');
  const userid = connectionsClientId.get(ws);
  if (sessions.has(message.sessionId || '') && userid) {
    const session = sessions.get(message.sessionId!)!;
    const client = Array.from(session.clients).find((client) => client.userid === userid);
    if (client && session.isStarted && !session.gezogen && session.atRow?.userid === userid) {
      if (session.ziehen! > 0) {
        for (let i = 0; i < session.ziehen!; i++) {
          const card: Card = session.cards.pop()!;
          if (card) {
            client.cards!.set(card.number + card.symbol, card);
            ws.send(JSON.stringify({ type: MessageType.CARD, payload: card }));
          } else {
            ws.send(JSON.stringify({ type: MessageType.ERROR, payload: 'No more cards' }));
          }
        }
        session.ziehen = 0;
      } else {
        const card = session.cards.pop();
        if (card) {
          client.cards!.set(card.number + card.symbol, card);
          ws.send(JSON.stringify({ type: MessageType.CARD, payload: card }));
          session.gezogen = true;
          session.clients.forEach((c) => {
            c.ws.send(JSON.stringify({ type: MessageType.ATROW, payload: { userid: session.atRow?.userid } }));
          });
        } else {
          ws.send(JSON.stringify({ type: MessageType.ERROR, payload: 'No more cards' }));
        }
      }
    } else {
      ws.send(JSON.stringify({ type: MessageType.ERROR, payload: "It's not your turn" }));
    }
  }
}

function kannNicht(ws: WebSocket, message: Message) {
  console.log('kannNicht');
  const userid = connectionsClientId.get(ws);
  if (sessions.has(message.sessionId || '') && userid) {
    const session = sessions.get(message.sessionId!)!;
    const client = Array.from(session.clients).find((client) => client.userid === userid);
    if (client && session.isStarted && session.gezogen && session.atRow?.userid === userid) {
      session.next = (session.next + 1) % session.clients.size;
      session.atRow = session.aktivPlayers![session.next];
      session.gezogen = false;
      session.clients.forEach((client) => {
        client.ws.send(
          JSON.stringify({
            type: MessageType.ATROW,
            payload: { userid: session.atRow?.userid },
          }),
        );
      });
    } else {
      ws.send(JSON.stringify({ type: MessageType.ERROR, payload: "It's not your turn" }));
    }
  }
}
