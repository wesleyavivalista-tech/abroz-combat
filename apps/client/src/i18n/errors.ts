import {t} from './index.js';
import type {MessageKey} from './en.js';

const errorKeys:Readonly<Record<string,MessageKey>> = {
  "Invalid message": "error.invalidMessage",
  "Invalid room code": "error.invalidCode",
  "Unknown message": "error.unknownMessage",
  "Invalid match mode": "error.invalidMode",
  "Invalid team": "error.invalidTeam",
  "Invalid arena": "error.invalidArena",
  "Too many connections from this network. Try again later.": "error.networkFull",
  "Too many connection attempts. Wait a minute and try again.": "error.connectionRate",
  "Too many lobby attempts. Wait a moment and try again.": "error.lobbyRate",
  "Server full": "error.serverFull",
  "Room not found": "error.notFound",
  "Already in this room": "error.alreadyJoined",
  "This match has already started. Reconnecting isn’t supported yet. Return to the menu to join or create another room.": "error.matchStarted",
  "Room is full": "error.roomFull",
  "That team is full. Choose another team or Auto balance.": "error.teamFull",
  "Match has not started": "error.notStarted",
  "Invalid input": "error.invalidInput",
  "Out-of-order input": "error.outOfOrder",
  "Input too far ahead": "error.ahead",
  "Input rate exceeded": "error.rate",
  "Waiting room expired": "error.expired",
  "Finished tournament closed after 15 minutes. Return to the menu to play again.": "error.tournamentClosed",
  "Tournament match forfeited after inactivity.": "error.tournamentForfeit",
  "Finished room closed after 15 minutes. Return to the menu to play again.": "error.roomClosed",
  "No gameplay input received before the inactivity deadline. Return to the menu to play again.": "error.idle",
  "Unknown character": "error.unknownFighter",
  "Game versions differ. Refresh the game before joining a room.": "error.version",
  "Connection cancelled": "error.cancelled",
  "Room server did not respond": "error.noResponse",
  "Room server closed the connection": "error.closed",
  "Invalid multiplayer server configuration.": "error.configuration",
  "Desktop multiplayer requires a secure WSS server.": "error.secure",
  "Online play is not configured in this desktop build. Local matches and training are available.": "error.offline",
  "Asset load cancelled": "error.assetCancelled",
};

/** Translate only at the UI boundary; unknown errors retain their diagnostic text. */
export function errorMessage(message:string):string {
  if(Object.hasOwn(errorKeys,message))return t(errorKeys[message]);
  const capacity=message.match(/^Room size must be 2–(8|16) fighters$/);
  if(capacity)return t('error.capacity',{count:Number(capacity[1])});
  if(message.startsWith('Cannot connect to room server on '))return t('error.connection',{url:message.slice('Cannot connect to room server on '.length)});
  if(message.startsWith('Could not load '))return t('error.asset',{url:message.slice('Could not load '.length)});
  return message;
}
