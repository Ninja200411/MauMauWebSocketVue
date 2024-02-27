import {CardNumber, CardSymbol, MessageType} from "@/helpers/enums";

export type Message = {
    type?: MessageType,
    sessionId?: string,
    payload?: any,
}
export type Card = {
    symbol: CardSymbol,
    number: CardNumber,
}

export type Client = {
    ws: WebSocket,
    userid: string,
    sessionId?: string,
    username: string,
    cards?: Set<Card>,
}
export type Session = {
    clients: Set<Client>,
    cards: Card[],
    isStarted: boolean,
    next: number,
    aktivPlayers?: Client[],
    atRow?: Client,
    places?: number,
    gezogen?: boolean
    topCard?: Card,
    ziehen?: number,
    color?: CardSymbol
}

export type Payload = {
    sessionId?: string,
    username?: string,
    color?: CardSymbol,
    symbol?: CardSymbol,
    number?: CardNumber,
}