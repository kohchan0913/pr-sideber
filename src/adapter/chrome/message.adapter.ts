import { sendMessage } from "../../shared/messaging";
import type { SendMessage } from "../../shared/ports/message.port";

export const chromeSendMessage: SendMessage = sendMessage;
